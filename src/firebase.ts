import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const configured = Object.values(config).every(Boolean);
const app = configured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
if (auth) auth.languageCode = "es";
export const demoEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === "true";
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (!auth?.currentUser) throw new Error("Inicia sesión para continuar.");
  const token = await auth.currentUser.getIdToken();
  const base = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
  const response = await fetch(base + "/api" + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("El servidor no devolvió una respuesta válida.");
  const result = await response.json().catch(() => {
    throw new Error("No se pudo leer la respuesta del servidor.");
  });
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw new Error("Respuesta del servidor no válida.");
  if (!response.ok)
    throw new Error(result.error || "No se pudo completar la operación.");
  return result as T;
}
