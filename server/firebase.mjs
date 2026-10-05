let services;

export async function getFirebaseServices() {
  if (services) return services;
  try {
    let account;
    const configured = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (configured) {
      account = JSON.parse(configured);
      if (
        !account || typeof account !== "object" || Array.isArray(account) ||
        typeof account.project_id !== "string" || !account.project_id ||
        typeof account.client_email !== "string" || !account.client_email ||
        typeof account.private_key !== "string" || !account.private_key ||
        (projectId && account.project_id !== projectId)
      ) throw new Error();
    } else if (process.env.VERCEL === "1") {
      throw new Error();
    }
    const { initializeApp, getApps, cert, applicationDefault } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    const { getFirestore } = await import("firebase-admin/firestore");
    const app = getApps().find((app) => app.name === "[DEFAULT]") || initializeApp({
      credential: account ? cert(account) : applicationDefault(),
      projectId: projectId || account?.project_id,
    });
    if (projectId && app.options.projectId && app.options.projectId !== projectId)
      throw new Error();
    services = { auth: getAuth(app), db: getFirestore(app) };
    return services;
  } catch {
    throw Object.assign(new Error("Firebase no esta disponible."), { status: 503 });
  }
}
