import { randomBytes } from "node:crypto";
import {
  canView,
  canEditTask,
  validateEntry,
  validateOffering,
  validateTask,
  validateTaskDependencies,
} from "../shared/domain.ts";
import {
  requireActive,
  requireAdmin,
  validateUserChange,
  taskProgressOnly,
} from "./permissions.mjs";

export function getAllowedOrigins(env = process.env) {
  const origins = new Set();
  if (!env.APP_ORIGIN && env.VERCEL !== "1")
    origins.add("http://localhost:8000");
  for (const value of (env.APP_ORIGIN || "").split(",")) {
    try {
      const url = new URL(value.trim());
      if (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        url.pathname === "/" &&
        !url.hostname.includes("*")
      )
        origins.add(url.origin);
    } catch {
      /* Invalid configuration never grants an origin. */
    }
  }
  if (env.VERCEL === "1") {
    for (const host of [env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) {
      if (
        typeof host === "string" &&
        /^[a-z\d]+(?:[a-z\d.-]*[a-z\d])?$/i.test(host)
      )
        origins.add("https://" + host.toLowerCase());
    }
  }
  return origins;
}
const publicProfile = (snap) => ({
  id: snap.id,
  name: snap.data().name,
  email: snap.data().email,
  role: snap.data().role,
  status: snap.data().status,
  invitedAt: snap.data().invitedAt || "",
});
function error(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function cleanOffering(data, id, createdAt) {
  return {
    id,
    name: data.name,
    campaignName: data.campaignName === undefined ? "" : data.campaignName,
    category: data.category,
    price: data.price,
    billing: data.billing,
    description: data.description,
    externalUrl: data.externalUrl || "",
    planningDescription: data.planningDescription || "",
    ...(data.milestoneCompleted !== undefined
      ? { milestoneCompleted: data.milestoneCompleted }
      : {}),
    start: data.start,
    end: data.end,
    goal: data.goal,
    unit: data.unit,
    budgets: data.budgets,
    enabledPlatforms: data.enabledPlatforms,
    targets: data.targets,
    ownerId: data.ownerId,
    memberIds: data.memberIds,
    milestoneDates: data.milestoneDates,
    driveUrl: data.driveUrl,
    createdAt,
  };
}
function cleanTask(data, id, createdAt) {
  return {
    id,
    title: data.title,
    milestone: data.milestone,
    ownerId: data.ownerId,
    ownerName: data.ownerName,
    start: data.start,
    end: data.end,
    blocked: data.blocked,
    subtasks: data.subtasks,
    parentId: data.parentId || "",
    description: data.description || "",
    status: data.status || "pending",
    priority: data.priority || "medium",
    predecessorIds: Array.isArray(data.predecessorIds)
      ? data.predecessorIds
      : [],
    isMilestone: Boolean(data.isMilestone),
    ...(data.progress !== undefined ? { progress: data.progress } : {}),
    ...(data.color !== undefined ? { color: data.color } : {}),
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
async function readBody(req) {
  const maxBytes = 1000000;
  const length = req.headers["content-length"];
  if (length !== undefined) {
    if (typeof length !== "string" || !/^\d+$/.test(length))
      error("Datos no validos.");
    if (Number(length) > maxBytes) error("Solicitud demasiado grande.", 413);
  }
  let supplied;
  try {
    supplied = req.body;
  } catch {
    error("Datos no validos.");
  }
  let raw,
    body,
    hasBody = false;
  if (supplied !== undefined) {
    if (typeof supplied === "string" || Buffer.isBuffer(supplied)) {
      raw = Buffer.isBuffer(supplied) ? supplied : Buffer.from(supplied);
    } else {
      try {
        raw = Buffer.from(JSON.stringify(supplied));
      } catch {
        error("Datos no validos.");
      }
      body = supplied;
    }
    hasBody = raw.length > 0;
    if (raw.length > maxBytes) error("Solicitud demasiado grande.", 413);
  } else {
    const chunks = [];
    let bytes = 0;
    try {
      const stream = req.iterator
        ? req.iterator({ destroyOnReturn: false })
        : req;
      for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > maxBytes) error("Solicitud demasiado grande.", 413);
        chunks.push(buffer);
      }
    } catch (e) {
      req.resume?.();
      if (e.status) throw e;
      error("Datos no validos.");
    }
    raw = Buffer.concat(chunks, bytes);
    hasBody = bytes > 0;
  }
  if (hasBody) {
    const type = req.headers["content-type"];
    if (
      typeof type !== "string" ||
      !/^application\/json(?:\s*;|\s*$)/i.test(type)
    )
      error("Se requiere Content-Type application/json.", 415);
    if (body === undefined) {
      try {
        body = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(raw),
        );
      } catch {
        error("Datos no validos.");
      }
    }
  } else body = {};
  if (!body || typeof body !== "object" || Array.isArray(body))
    error("Datos no validos.");
  return body;
}

const tokenErrors = new Set([
  "auth/argument-error",
  "auth/invalid-argument",
  "auth/invalid-id-token",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/user-disabled",
  "auth/user-not-found",
  "auth/tenant-id-mismatch",
]);

export function createApiHandler({
  auth: injectedAuth,
  db: injectedDb,
  allowedOrigins = getAllowedOrigins(),
  rateLimits = {},
} = {}) {
  const origins = new Set(allowedOrigins);
  // Best-effort per-instance throttling, not a distributed security boundary.
  const rates = new Map();
  const windowMs = rateLimits.windowMs ?? 60000;
  const maxRequests = rateLimits.maxRequests ?? 120;
  return async (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Vary", "Origin");
    const origin = req.headers.origin;
    const originAllowed = typeof origin === "string" && origins.has(origin);
    if (originAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, OPTIONS",
      );
    }
    if (req.method === "OPTIONS") {
      res.writeHead(originAllowed ? 204 : 403);
      res.end();
      return;
    }
    const respond = (data, status = 200) => {
      res.writeHead(status);
      res.end(JSON.stringify(data));
    };
    try {
      if (origin !== undefined && !originAllowed)
        error("Origen no autorizado.", 403);
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (
        ["/health", "/api/health"].includes(pathname) &&
        req.method === "GET"
      ) {
        respond({ ok: true });
        return;
      }
      const knownRoute =
        (pathname === "/api/snapshot" && req.method === "GET") ||
        (["/api/activate", "/api/users"].includes(pathname) &&
          req.method === "POST") ||
        (/^\/api\/users\/[\w-]+$/.test(pathname) && req.method === "PATCH") ||
        (/^\/api\/users\/[\w-]+\/resend$/.test(pathname) &&
          req.method === "POST") ||
        (/^\/api\/offerings\/[\w-]+(?:\/(tasks|entries)\/[\w-]+)?$/.test(
          pathname,
        ) &&
          req.method === "PUT");
      if (!knownRoute) error("Ruta no encontrada.", 404);
      const authorization = req.headers.authorization;
      const bearer =
        typeof authorization === "string"
          ? authorization.match(/^Bearer (.+)$/i)?.[1]
          : undefined;
      if (!bearer) error("Inicia sesión para continuar.", 401);
      const body = await readBody(req);
      let services;
      try {
        services =
          injectedAuth && injectedDb
            ? { auth: injectedAuth, db: injectedDb }
            : await (await import("./firebase.mjs")).getFirebaseServices();
      } catch {
        error("Servicio no disponible.", 503);
      }
      const { auth, db } = services;
      let token;
      try {
        token = await auth.verifyIdToken(bearer, true);
      } catch (e) {
        console.error(
          "auth_verification_failed",
          e.code || e.name || "unknown",
        );
        error(
          "Tu sesión ha caducado. Inicia sesión de nuevo.",
          tokenErrors.has(e.code) ? 401 : 503,
        );
      }
      const userRef = db.doc("users/" + token.uid),
        userSnap = await userRef.get(),
        profile = userSnap.exists ? publicProfile(userSnap) : null;
      const now = Date.now(),
        limit = rates.get(token.uid);
      if (!limit || now - limit.at > windowMs)
        rates.set(token.uid, { at: now, n: 1 });
      else if (++limit.n > maxRequests)
        error("Demasiadas solicitudes. Espera un minuto.", 429);
      if (rates.size > 10000)
        for (const [key, v] of rates)
          if (now - v.at > windowMs) rates.delete(key);
      if (pathname === "/api/activate" && req.method === "POST") {
        if (!token.email_verified)
          error("Valida tu correo antes de activar la cuenta.", 403);
        await db.runTransaction(async (tx) => {
          const s = await tx.get(userRef),
            p = s.data();
          if (!p || !["invited", "active"].includes(p.status))
            error("No tienes una invitación activa.", 403);
          if (
            typeof p.email !== "string" ||
            p.email.toLowerCase() !== token.email?.toLowerCase()
          )
            error("La invitación no corresponde a este correo.", 403);
          if (p.status === "active") return;
          if (
            !Number.isFinite(p.inviteExpiresAt) ||
            p.inviteExpiresAt <= Date.now()
          )
            error(
              "La invitación ha caducado. Pide al administrador que la reenvíe.",
              403,
            );
          tx.update(userRef, {
            status: "active",
            activatedAt: new Date().toISOString(),
          });
        });
        respond({ ok: true });
        return;
      }
      requireActive(profile, token.email_verified);
      if (
        typeof profile.email !== "string" ||
        profile.email.toLowerCase() !== token.email?.toLowerCase()
      )
        error("Tu correo no coincide con el acceso autorizado.", 403);
      if (pathname === "/api/snapshot" && req.method === "GET") {
        const offeringQuery =
          profile.role === "admin"
            ? db.collection("offerings")
            : db
                .collection("offerings")
                .where("memberIds", "array-contains", profile.id);
        const [offeringDocs, people] = await Promise.all([
          offeringQuery.get(),
          profile.role === "admin"
            ? db.collection("users").get()
            : Promise.resolve(null),
        ]);
        const offerings = offeringDocs.docs.map((s) => s.data()),
          tasks = {},
          entries = {};
        await Promise.all(
          offerings.map(async (o) => {
            const [ts, es] = await Promise.all([
              db.collection("offerings/" + o.id + "/tasks").get(),
              db.collection("offerings/" + o.id + "/entries").get(),
            ]);
            tasks[o.id] = ts.docs.map((s) => s.data());
            entries[o.id] = es.docs.map((s) => s.data());
          }),
        );
        respond({
          offerings,
          tasks,
          entries,
          profiles: people ? people.docs.map(publicProfile) : [profile],
        });
        return;
      }
      if (pathname === "/api/users" && req.method === "POST") {
        requireAdmin(profile);
        const { name, email, role } = body;
        if (
          typeof name !== "string" ||
          !name.trim() ||
          name.length > 100 ||
          typeof email !== "string" ||
          email.length > 254 ||
          !/^\S+@\S+\.\S+$/.test(email) ||
          !["admin", "collaborator"].includes(role)
        )
          error("Introduce nombre, correo y rol válidos.");
        let user;
        try {
          user = await auth.createUser({
            email: email.toLowerCase().trim(),
            displayName: name.trim(),
            password: randomBytes(32).toString("base64url"),
            emailVerified: false,
          });
        } catch (e) {
          if (e.code === "auth/email-already-exists")
            error("Este correo ya está registrado.");
          throw e;
        }
        try {
          await db.doc("users/" + user.uid).create({
            name: name.trim(),
            email: user.email,
            role,
            status: "invited",
            invitedAt: new Date().toISOString(),
            inviteExpiresAt: Date.now() + 7 * 86400000,
          });
        } catch (e) {
          await auth.deleteUser(user.uid);
          throw e;
        }
        respond({ id: user.uid }, 201);
        return;
      }
      const userRoute = pathname.match(/^\/api\/users\/([\w-]+)(\/resend)?$/);
      if (userRoute) {
        requireAdmin(profile);
        const id = userRoute[1],
          ref = db.doc("users/" + id),
          snap = await ref.get();
        if (!snap.exists) error("Usuario no encontrado.", 404);
        if (userRoute[2] && req.method === "POST") {
          if (snap.data().status !== "invited")
            error("Solo se reenvían invitaciones pendientes.");
          await ref.update({
            invitedAt: new Date().toISOString(),
            inviteExpiresAt: Date.now() + 7 * 86400000,
          });
          respond({ ok: true });
          return;
        }
        if (req.method === "PATCH") {
          validateUserChange(profile.id, id, body);
          const target = await auth.getUser(id);
          if (body.status === "active" && !target.emailVerified)
            error("El usuario debe validar su correo antes de activarse.");
          // Firestore first: revocation remains effective even if the Auth call fails.
          await ref.update({
            role: body.role,
            status: body.status,
            ...(body.status === "invited"
              ? { inviteExpiresAt: Date.now() + 7 * 86400000 }
              : {}),
          });
          await auth.updateUser(id, { disabled: body.status === "disabled" });
          await auth.revokeRefreshTokens(id);
          respond({ ok: true });
          return;
        }
      }
      const offeringRoute = pathname.match(
        /^\/api\/offerings\/([\w-]+)(?:\/(tasks|entries)\/([\w-]+))?$/,
      );
      if (offeringRoute && req.method === "PUT") {
        const [, id, kind, childId] = offeringRoute,
          ref = db.doc("offerings/" + id);
        await db.runTransaction(async (tx) => {
          // Re-read permission data in the same transaction as each mutation.
          const actorSnap = await tx.get(userRef),
            actor = { ...actorSnap.data(), id: profile.id };
          requireActive(actor, token.email_verified);
          const snap = await tx.get(ref),
            o = snap.exists ? snap.data() : null;
          if (!kind) {
            requireAdmin(actor);
            const next = validateOffering(
              cleanOffering(body, id, o?.createdAt || new Date().toISOString()),
            );
            for (const member of next.memberIds) {
              if (!/^[\w-]+$/.test(member)) error("Usuario no válido.");
              const memberSnap = await tx.get(db.doc("users/" + member));
              if (!memberSnap.exists || memberSnap.data().status !== "active")
                error("El equipo solo puede contener usuarios activos.");
            }
            if (o) {
              const [ts, es] = await Promise.all([
                tx.get(ref.collection("tasks")),
                tx.get(ref.collection("entries")),
              ]);
              ts.docs.forEach((t) => validateTask(t.data(), next));
              es.docs.forEach((e) => validateEntry(e.data(), next));
            }
            tx.set(ref, next);
            return;
          }
          if (!o || !canView(actor, o))
            error("Offering no encontrado o sin permiso.", 403);
          if (kind === "entries") {
            requireAdmin(actor);
            const next = validateEntry(
              {
                id: childId,
                date: body.date,
                platform: body.platform,
                queries: body.queries,
                closed: body.closed,
                spent: body.spent,
              },
              o,
            );
            if (childId !== next.date + "_" + next.platform)
              error("Identificador de registro no válido.");
            tx.set(ref.collection("entries").doc(childId), next);
            return;
          }
          const taskRef = ref.collection("tasks").doc(childId),
            previous = await tx.get(taskRef),
            next = cleanTask(
              body,
              childId,
              previous.exists ? previous.data().createdAt : undefined,
            );
          if (actor.role !== "admin") {
            if (
              !previous.exists ||
              !canEditTask(actor, o, previous.data()) ||
              !taskProgressOnly(previous.data(), next)
            )
              error(
                "Solo puedes actualizar el cumplimiento de tus tareas.",
                403,
              );
          }
          validateTask(next, o);
          const projectTasks = await tx.get(ref.collection("tasks"));
          validateTaskDependencies(
            next,
            projectTasks.docs.map((doc) => doc.data()),
          );
          const ownerSnap = await tx.get(db.doc("users/" + next.ownerId));
          if (!ownerSnap.exists || ownerSnap.data().status !== "active")
            error("Responsable no disponible.");
          for (const subOwner of new Set(
            next.subtasks.map((sub) => sub.ownerId).filter(Boolean),
          )) {
            const user = await tx.get(db.doc("users/" + subOwner));
            if (!user.exists || user.data().status !== "active")
              error("Responsable de subtarea no disponible.");
          }
          next.ownerName = ownerSnap.data().name;
          tx.set(taskRef, next);
        });
        respond({ ok: true });
        return;
      }
      error("Ruta no encontrada.", 404);
    } catch (e) {
      if (!e.status || e.status >= 500)
        console.error("api_request_failed", e.code || e.name || "unknown");
      const status = e.status || (e.code ? 503 : 400);
      respond(
        {
          error:
            status >= 500
              ? "El servidor no pudo completar la operación. Revisa la configuración de Firebase."
              : e.message || "No se pudo completar la operación.",
        },
        status,
      );
    }
  };
}

let defaultHandler;
export default function handler(req, res) {
  defaultHandler ??= createApiHandler();
  return defaultHandler(req, res);
}
