import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import handler, { createApiHandler, getAllowedOrigins } from "../server/handler.mjs";
import vercelHandler, { createVercelHandler } from "../api/index.mjs";

const origin = "http://localhost:8000";
const profile = () => ({
  name: "Test User", email: "test@example.test", role: "admin", status: "active",
});
const claims = () => ({ uid: "user-1", email: "test@example.test", email_verified: true });
const offering = () => ({
  id: "project-1", name: "Project", category: "Cursos", price: 100,
  billing: "Mensual", description: "", start: "2025-01-01", end: "2025-01-31",
  goal: 1, unit: "Sales", budgets: { Meta: 0, Google: 0, TikTok: 0 },
  enabledPlatforms: ["Meta"], targets: [{ date: "2025-01-31", count: 1 }],
  ownerId: "user-1", memberIds: ["user-1"],
  milestoneDates: ["2025-01-01", "2025-01-07", "2025-01-14", "2025-01-31"],
  driveUrl: "", createdAt: "2025-01-01T00:00:00.000Z",
});
const task = () => ({
  id: "task-1", title: "Task", milestone: 0, ownerId: "user-1", ownerName: "Test User",
  start: "2025-01-01", end: "2025-01-07", blocked: false,
  subtasks: [{ title: "Step", done: false }], createdAt: "2025-01-02T00:00:00.000Z",
});

function fakeServices({ user = profile(), token = claims(), tokenError, documents = {} } = {}) {
  const rows = new Map(Object.entries(documents));
  if (user) rows.set("users/user-1", user);
  const calls = [];
  const snapshot = (path) => ({
    id: path.split("/").at(-1), exists: rows.has(path), data: () => rows.get(path),
  });
  const collection = (path, filter) => ({
    path, filter,
    doc: (id) => doc(path + "/" + id),
    where: (...condition) => collection(path, condition),
    get: async () => {
      calls.push(["query", path, filter]);
      const paths = [...rows.keys()].filter((key) =>
        key.startsWith(path + "/") && !key.slice(path.length + 1).includes("/"),
      );
      return { docs: paths.filter((key) => !filter || rows.get(key)[filter[0]]?.includes(filter[2])).map(snapshot) };
    },
  });
  const doc = (path) => ({
    path, get: async () => snapshot(path), collection: (name) => collection(path + "/" + name),
    create: async (value) => { calls.push(["create", path]); rows.set(path, value); },
    update: async (value) => { calls.push(["update", path]); rows.set(path, { ...rows.get(path), ...value }); },
  });
  const auth = {
    verifyIdToken: async (...args) => {
      calls.push(["verify", ...args]);
      if (tokenError) throw Object.assign(new Error("PRIVATE SDK DETAIL"), { code: tokenError });
      return token;
    },
    createUser: async (value) => { calls.push(["createUser", value]); return { uid: "new-user", email: value.email }; },
    deleteUser: async (id) => { calls.push(["deleteUser", id]); },
    getUser: async () => ({ emailVerified: true }),
    updateUser: async (...args) => { calls.push(["updateUser", ...args]); },
    revokeRefreshTokens: async (id) => { calls.push(["revoke", id]); },
  };
  const db = {
    doc, collection,
    runTransaction: async (callback) => {
      calls.push(["transaction"]);
      const writes = [];
      const result = await callback({
        get: async (ref) => ref.get(),
        update: (ref, value) => writes.push(() => rows.set(ref.path, { ...rows.get(ref.path), ...value })),
        set: (ref, value) => writes.push(() => rows.set(ref.path, value)),
      });
      writes.forEach((write) => write());
      return result;
    },
  };
  return { auth, db, calls, rows };
}

async function serve(t, apiHandler, before) {
  const server = createServer(async (req, res) => {
    try {
      await before?.(req);
      await apiHandler(req, res);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return "http://127.0.0.1:" + server.address().port;
}

function authenticated(method = "GET", body) {
  return {
    method,
    headers: { Authorization: "Bearer test-token", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
  };
}

test("health, OPTIONS, missing token and unknown API do not initialize Firebase", async (t) => {
  const base = await serve(t, handler);
  for (const path of ["/health", "/api/health"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal((await fetch(base + "/api/snapshot")).status, 401);
  const unknown = await fetch(base + "/api/unknown");
  assert.equal(unknown.status, 404);
  assert.match(unknown.headers.get("content-type"), /application\/json/);
  assert.equal((await fetch(base + "/api/snapshot", { method: "OPTIONS", headers: { Origin: origin } })).status, 204);
});

test("CORS uses exact configured origins and permits no-Origin authenticated CLI requests", async (t) => {
  const services = fakeServices();
  const base = await serve(t, createApiHandler({ ...services, allowedOrigins: [origin, "https://app.example.test"] }));
  for (const allowed of [origin, "https://app.example.test"]) {
    const response = await fetch(base + "/api/snapshot", { method: "OPTIONS", headers: { Origin: allowed } });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), allowed);
    assert.equal(response.headers.get("vary"), "Origin");
    assert.match(response.headers.get("access-control-allow-headers"), /Authorization/);
  }
  for (const headers of [{}, { Origin: "https://evil.example.test" }, { Origin: origin + ", https://evil.example.test" }]) {
    const response = await fetch(base + "/api/snapshot", { method: "OPTIONS", headers });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
  const wrong = await fetch(base + "/api/snapshot", { headers: { Origin: "https://evil.example.test", Authorization: "Bearer test-token" } });
  assert.equal(wrong.status, 403);
  assert.equal(services.calls.length, 0);
  const response = await fetch(base + "/api/snapshot", authenticated());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.deepEqual(services.calls[0], ["verify", "test-token", true]);
});

test("origin environment parsing ignores arbitrary hosts, wildcards and Vercel variables outside Vercel", () => {
  const env = {
    APP_ORIGIN: "https://app.example.test, http://localhost:3000, https://*.evil.test, https://evil.test/path, https://user@evil.test",
    VERCEL_URL: "preview.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "production.vercel.app",
  };
  assert.deepEqual([...getAllowedOrigins(env)], ["https://app.example.test", "http://localhost:3000"]);
  assert.deepEqual([...getAllowedOrigins({ ...env, VERCEL: "1" })], [
    "https://app.example.test", "http://localhost:3000", "https://preview.vercel.app", "https://production.vercel.app",
  ]);
  assert.deepEqual([...getAllowedOrigins({ VERCEL: "1", VERCEL_URL: "evil.test/path", VERCEL_PROJECT_PRODUCTION_URL: "*.evil.test" })], []);
  assert.deepEqual([...getAllowedOrigins({})], [origin]);
});

test("missing, disabled, invited, unverified and mismatched profiles cannot read snapshots", async (t) => {
  for (const options of [
    { user: null }, { user: { ...profile(), status: "disabled" } },
    { user: { ...profile(), status: "invited" } },
    { token: { ...claims(), email_verified: false } },
    { token: { ...claims(), email: "other@example.test" } },
    { user: { ...profile(), email: undefined } },
  ]) {
    const services = fakeServices(options);
    const base = await serve(t, createApiHandler(services));
    assert.equal((await fetch(base + "/api/snapshot", authenticated())).status, 403);
    assert.equal(services.calls.some(([kind]) => kind === "query"), false);
  }
});

test("revoked and invalid tokens return 401; credential/configuration failures are sanitized 503", async (t) => {
  for (const [code, status] of [
    ["auth/id-token-expired", 401], ["auth/id-token-revoked", 401], ["auth/invalid-id-token", 401],
    ["auth/argument-error", 401], ["auth/user-disabled", 401],
    ["auth/invalid-credential", 503], ["auth/insufficient-permission", 503], ["app/invalid-credential", 503],
    ["auth/internal-error", 503],
  ]) {
    const base = await serve(t, createApiHandler(fakeServices({ tokenError: code })));
    const response = await fetch(base + "/api/snapshot", authenticated());
    assert.equal(response.status, status, code);
    assert.doesNotMatch(await response.text(), /PRIVATE SDK DETAIL/);
  }
});

test("native request bodies require object JSON and enforce byte limits with content-length and chunked streams", async (t) => {
  const base = await serve(t, createApiHandler(fakeServices()));
  for (const body of ["{", "null", "[]", "1", '"string"', " "]) {
    assert.equal((await fetch(base + "/api/activate", authenticated("POST", body))).status, 400, body);
  }
  assert.equal((await fetch(base + "/api/activate", authenticated("POST", {}))).status, 200);
  const wrongType = authenticated("POST", "{}");
  wrongType.headers["Content-Type"] = "text/plain";
  assert.equal((await fetch(base + "/api/activate", wrongType)).status, 415);
  assert.equal((await fetch(base + "/api/activate", authenticated("POST", { text: "a".repeat(1000000) }))).status, 413);
  const exact = JSON.stringify({ text: "a".repeat(999989) });
  assert.equal(Buffer.byteLength(exact), 1000000);
  assert.equal((await fetch(base + "/api/activate", authenticated("POST", exact))).status, 200);
  async function* chunks() {
    yield Buffer.from('{"text":"');
    for (let n = 0; n < 20; n++) yield Buffer.from("\u00e9".repeat(30000));
    yield Buffer.from('"}');
  }
  const chunked = authenticated("POST");
  chunked.headers["Content-Type"] = "application/json";
  const response = await fetch(base + "/api/activate", { ...chunked, body: chunks(), duplex: "half" });
  assert.equal(response.status, 413);
});

test("Vercel consumed/parsed bodies, buffers, malformed getters and oversized content-length are handled", async (t) => {
  for (const [supplied, status] of [
    [{}, 200], ["{}", 200], [Buffer.from("{}"), 200], ["", 200],
    [null, 400], [[], 400], ["{", 400], [42, 400],
    [{ text: "\u00e9".repeat(500000) }, 413], [Buffer.alloc(1000001), 413],
  ]) {
    const base = await serve(t, createApiHandler(fakeServices()), async (req) => {
      for await (const chunk of req) { void chunk; }
      req.body = supplied;
    });
    const response = await fetch(base + "/api/activate", authenticated("POST", {}));
    assert.equal(response.status, status, typeof supplied);
  }
  const getterBase = await serve(t, createApiHandler(fakeServices()), (req) => {
    Object.defineProperty(req, "body", { get() { throw new Error("PRIVATE PARSER DETAIL"); } });
  });
  const malformed = await fetch(getterBase + "/api/activate", authenticated("POST", "{"));
  assert.equal(malformed.status, 400);
  assert.doesNotMatch(await malformed.text(), /PRIVATE PARSER DETAIL/);
  const lengthBase = await serve(t, createApiHandler(fakeServices()), (req) => {
    req.headers["content-length"] = "1000001";
    Object.defineProperty(req, "body", { get() { throw new Error("Must not read oversized body"); } });
  });
  assert.equal((await fetch(lengthBase + "/api/activate", authenticated("POST", {}))).status, 413);
});

test("Vercel wrapper supports health, direct routes and nested rewrite paths while discarding other query parameters", async (t) => {
  const healthBase = await serve(t, vercelHandler);
  for (const path of ["/health", "/api/health", "/api/index?__route=health"]) {
    assert.equal((await fetch(healthBase + path)).status, 200);
  }
  for (const path of ["/", "/api", "/api/", "/api/index", "/api/index?__route=", "/api/index?__route=unknown"]) {
    const response = await fetch(healthBase + path);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /application\/json/);
  }
  const seen = [];
  const services = fakeServices({ documents: { "offerings/project-1": offering() } });
  const api = createApiHandler(services);
  const base = await serve(t, createVercelHandler((req, res) => {
    seen.push(req.url);
    return api(req, res);
  }));
  assert.equal((await fetch(base + "/api/snapshot?other=ignored", authenticated())).status, 200);
  assert.equal((await fetch(base + "/api/index?__route=snapshot&redirect=/evil&role=admin", authenticated())).status, 200);
  assert.equal((await fetch(base + "/api/index?__route=offerings%2Fproject-1%2Ftasks%2Ftask-1", authenticated("PUT", task()))).status, 200);
  assert.deepEqual(seen, ["/api/snapshot", "/api/snapshot", "/api/offerings/project-1/tasks/task-1"]);
  const preflight = await fetch(base + "/api/index?__route=snapshot", { method: "OPTIONS", headers: { Origin: origin } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
  assert.equal((await fetch(base + "/api/index?__route=snapshot", { headers: { Origin: "https://evil.test" } })).status, 403);
});

test("Vercel wrapper rejects duplicate routes, path injection and double decoding", async (t) => {
  const base = await serve(t, createVercelHandler(() => assert.fail("Invalid path reached API")));
  for (const query of [
    "__route=snapshot&__route=users", "__route=health&%5F%5Froute=health",
    "__route=.", "__route=..", "__route=users/../snapshot", "__route=users//id",
    "__route=/snapshot", "__route=snapshot/", "__route=users%5Cid", "__route=%252e%252e",
    "__route=snapshot%3Frole=admin", "__route=snapshot%23fragment", "__route=snapshot%00",
    "__route=https://evil.test", "__route=%7F", "__route=%", "__route=snapshot.html",
  ]) {
    const response = await fetch(base + "/api/index?" + query);
    assert.equal(response.status, 400, query);
    assert.match(response.headers.get("content-type"), /application\/json/);
  }
  for (const path of ["/api/users//id", "/api/snapshot/", "/api/%252e%252e", "/api/users%5Cid"]) {
    assert.equal((await fetch(base + path)).status, 400, path);
  }
  for (const path of ['/api/unknown?__route=health','/api/unknown?__route=snapshot','/api/snapshot?__route=users']) {
    assert.equal((await fetch(base+path)).status,400,path);
  }
});

test("invitation activation requires verified matching email and an unexpired finite invitation", async (t) => {
  for (const expires of [undefined, null, "9999999999999", Date.now() - 1000]) {
    const services = fakeServices({ user: { ...profile(), status: "invited", inviteExpiresAt: expires } });
    const base = await serve(t, createApiHandler(services));
    assert.equal((await fetch(base + "/api/activate", authenticated("POST", {}))).status, 403);
    assert.equal(services.rows.get("users/user-1").status, "invited");
  }
  for (const options of [
    { user: null }, { user: { ...profile(), status: "disabled" } },
    { token: { ...claims(), email_verified: false } },
    { token: { ...claims(), email: "wrong@test.test" } },
    { user: { ...profile(), status: "invited", inviteExpiresAt: Date.now() + 60000 }, token: { ...claims(), email: "wrong@test.test" } },
  ]) {
    const base = await serve(t, createApiHandler(fakeServices(options)));
    assert.equal((await fetch(base + "/api/activate", authenticated("POST", {}))).status, 403);
  }
  const services = fakeServices({ user: { ...profile(), status: "invited", inviteExpiresAt: Date.now() + 60000 } });
  const base = await serve(t, createApiHandler(services));
  assert.equal((await fetch(base + "/api/activate", authenticated("POST", {}))).status, 200);
  assert.equal(services.rows.get("users/user-1").status, "active");
  assert.ok(services.rows.get("users/user-1").activatedAt);
});

test("task updates preserve server creation time and collaborator progress-only permissions", async (t) => {
  const previous = task();
  const services = fakeServices({
    user: { ...profile(), role: "collaborator" },
    documents: { "offerings/project-1": offering(), "offerings/project-1/tasks/task-1": previous },
  });
  const base = await serve(t, createApiHandler(services));
  const path = "/api/offerings/project-1/tasks/task-1";
  const next = { ...previous, createdAt: "2099-01-01", status: "in_progress", progress: 50 };
  assert.equal((await fetch(base + path, authenticated("PUT", next))).status, 200);
  assert.equal(services.rows.get("offerings/project-1/tasks/task-1").createdAt, previous.createdAt);
  assert.equal((await fetch(base + path, authenticated("PUT", { ...next, title: "Unauthorized rename" }))).status, 403);
  assert.equal((await fetch(base + "/api/users", authenticated("POST", { name: "Name", email: "new@test.test", role: "admin" }))).status, 403);
  const snapshot = await (await fetch(base + "/api/snapshot", authenticated())).json();
  assert.equal(snapshot.offerings.length, 1);
  assert.equal(snapshot.profiles.length, 1);
  assert.ok(services.calls.some((call) => call[0] === "query" && call[1] === "offerings" && call[2]?.[0] === "memberIds"));
});

test("user role/status changes retain revocation and resend updates only pending invitations", async (t) => {
  const services = fakeServices({ documents: { "users/target": { ...profile(), status: "invited" } } });
  const base = await serve(t, createApiHandler(services));
  assert.equal((await fetch(base + "/api/users/target/resend", authenticated("POST", {}))).status, 200);
  assert.ok(services.rows.get("users/target").inviteExpiresAt > Date.now());
  assert.equal((await fetch(base + "/api/users/target", authenticated("PATCH", { role: "collaborator", status: "disabled" }))).status, 200);
  assert.equal(services.rows.get("users/target").status, "disabled");
  assert.deepEqual(services.calls.slice(-3), [
    ["update", "users/target"], ["updateUser", "target", { disabled: true }], ["revoke", "target"],
  ]);
  assert.equal((await fetch(base + "/api/users/target/resend", authenticated("POST", {}))).status, 400);
});

test("offering and entry routes retain admin validation, transactional writes and permission rechecks", async (t) => {
  const services = fakeServices();
  const base = await serve(t, createApiHandler(services));
  const project = offering();
  const path = "/api/offerings/project-1";
  assert.equal((await fetch(base + path, authenticated("PUT", project))).status, 200);
  assert.equal((await fetch(base + path, authenticated("PUT", { ...project, createdAt: "2099-01-01", name: "Updated" }))).status, 200);
  const stored = services.rows.get("offerings/project-1");
  assert.equal(stored.name, "Updated");
  assert.notEqual(stored.createdAt, "2099-01-01");
  const entry = { date: "2025-01-03", platform: "Meta", queries: 2, closed: 1, spent: 100 };
  assert.equal((await fetch(base + path + "/entries/2025-01-03_Meta", authenticated("PUT", entry))).status, 200);
  assert.equal(services.rows.get("offerings/project-1/entries/2025-01-03_Meta").spent, 100);
  assert.equal((await fetch(base + path + "/entries/wrong", authenticated("PUT", entry))).status, 400);
  assert.equal((await fetch(base + path + "/entries/2025-01-03_Meta", authenticated("PUT", { ...entry, spent: -1 }))).status, 400);
  const transact = services.db.runTransaction;
  services.db.runTransaction = async (callback) => {
    services.rows.set("users/user-1", { ...profile(), status: "disabled" });
    return transact(callback);
  };
  assert.equal((await fetch(base + path, authenticated("PUT", { ...project, name: "Must not write" }))).status, 403);
  assert.equal(services.rows.get("offerings/project-1").name, "Updated");
});

test("rate limits are configurable per handler instance", async (t) => {
  const services = fakeServices();
  const base = await serve(t, createApiHandler({ ...services, rateLimits: { maxRequests: 1, windowMs: 60000 } }));
  assert.equal((await fetch(base + "/api/snapshot", authenticated())).status, 200);
  assert.equal((await fetch(base + "/api/snapshot", authenticated())).status, 429);
  const independent = await serve(t, createApiHandler({ ...services, rateLimits: { maxRequests: 1 } }));
  assert.equal((await fetch(independent + "/api/snapshot", authenticated())).status, 200);
});

test("Vercel credential failures stay closed and sanitized without live Firebase access", () => {
  const script = `
    import assert from 'node:assert/strict';
    import { getFirebaseServices } from './server/firebase.mjs';
    await assert.rejects(getFirebaseServices(), (e) => e.status === 503 && !e.message.includes('PRIVATE'));
  `;
  for (const env of [
    { VERCEL: "1" },
    { VERCEL: "1", FIREBASE_SERVICE_ACCOUNT_JSON: "PRIVATE MALFORMED JSON" },
    {
      VERCEL: "1", GOOGLE_CLOUD_PROJECT: "expected", FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        project_id: "wrong", client_email: "fake@example.test", private_key: "PRIVATE FAKE KEY",
      })
    },
  ]) {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: new URL("..", import.meta.url), env, encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
  }
});
