import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const base = process.env.VERIFY_URL || "http://localhost:8000";
const html = `<!doctype html><html><head><link rel="icon" href="data:,"></head><body><div id="root"></div><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import { AccessGate } from '/src/Auth.tsx';
window.__apiCalls=[];
window.__gateStore={profile:PROFILE,identity:{uid:'test-user',emailVerified:false,reload:async function(){this.emailVerified=true},getIdToken:async()=> 'test-only'},error:'',refresh:async()=>{},logout:async()=>{}};
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AccessGate));
</script></body></html>`;
try {
  const context = await browser.newContext();
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  await page.goto(base);
  assert(
    await page
      .getByRole("button", { name: "Entrar →", exact: true })
      .isEnabled(),
  );
  await page.route("**/src/store.tsx*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "export const useStore=()=>window.__gateStore;",
    }),
  );
  await page.route("**/src/firebase.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "export const auth=null,configured=true,demoEnabled=false; export const api=async (...args)=>{window.__apiCalls.push(args);return {};};",
    }),
  );
  await page.route("**/__auth-gate-test*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: html.replace(
        "PROFILE",
        route.request().url().includes("disabled=1")
          ? JSON.stringify({ status: "disabled" })
          : "null",
      ),
    }),
  );
  await page.goto(base + "/__auth-gate-test");
  await page
    .getByRole("button", { name: "Enviar correo de validación", exact: true })
    .waitFor();
  assert(
    await page
      .getByRole("button", { name: "Enviar correo de validación", exact: true })
      .isVisible(),
  );
  await page
    .getByRole("button", { name: "Ya he validado mi correo", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Falta que un administrador autorice" })
    .waitFor();
  assert.deepEqual(await page.evaluate(() => window.__apiCalls), []);
  assert.equal(
    await page
      .getByRole("button", { name: "Activar cuenta", exact: true })
      .count(),
    0,
  );
  await page.goto(base + "/__auth-gate-test?disabled=1");
  await page
    .getByRole("heading", { name: "Cuenta desactivada", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Enviar correo de validación", exact: true })
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Login real habilitado. Verificación sin perfil permitida; no activa ni autoriza la cuenta. No se enviaron correos reales.",
  );
  await context.close();
} finally {
  await browser.close();
}
