import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const output = process.env.VERIFY_OUTPUT || join(tmpdir(), "opencode");
const bundle = {
  profiles: [
    {
      id: "demo-admin",
      name: "Ana",
      email: "ana@example.test",
      role: "admin",
      status: "active",
    },
  ],
  offerings: [
    {
      id: "expense-test",
      name: "Clases regulares",
      description: "Ejemplo de curso",
      category: "Cursos",
      price: 9000,
      billing: "Por inscripción",
      start: "2026-10-01",
      end: "2026-10-31",
      goal: 20,
      unit: "Inscripciones",
      budgets: { Meta: 15000, Google: 10000, TikTok: 5000 },
      enabledPlatforms: ["Meta", "Google", "TikTok"],
      targets: [{ date: "2026-10-31", count: 20 }],
      ownerId: "demo-admin",
      memberIds: ["demo-admin"],
      milestoneDates: ["2026-10-01", "2026-10-07", "2026-10-14", "2026-10-31"],
      driveUrl: "",
      createdAt: "2026-10-01",
    },
  ],
  tasks: {},
  entries: {
    "expense-test": [
      {
        id: "2026-10-01_Meta",
        date: "2026-10-01",
        platform: "Meta",
        queries: 2,
        closed: 1,
        spent: 3000,
      },
      {
        id: "2026-10-02_Meta",
        date: "2026-10-02",
        platform: "Meta",
        queries: 2,
        closed: 1,
        spent: 3000,
      },
      {
        id: "2026-10-02_Google",
        date: "2026-10-02",
        platform: "Google",
        queries: 2,
        closed: 1,
        spent: 1000,
      },
      {
        id: "2026-10-03_TikTok",
        date: "2026-10-03",
        platform: "TikTok",
        queries: 2,
        closed: 1,
        spent: 500,
      },
    ],
  },
};
const results = [];
try {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("http://127.0.0.1:8000/");
    await page.evaluate(
      (data) => localStorage.setItem("gantsta.demo.v4", JSON.stringify(data)),
      bundle,
    );
    await page
      .getByRole("button", {
        name: "Probar la aplicación con datos de ejemplo",
      })
      .click();
    await page.evaluate(() => (location.hash = "#/offering/expense-test"));
    await page
      .getByRole("heading", { name: "Clases regulares", exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Ver planificación" }).count(),
      1,
    );
    const history = page.locator(".spend-history");
    assert.equal(
      await page.getByText("Desglose por plataforma", { exact: true }).count(),
      0,
    );
    assert.equal(await history.getAttribute("open"), null);
    await history.locator(":scope > summary").click();
    await history
      .getByRole("button", { name: "Editar nombre", exact: true })
      .click();
    await history
      .getByLabel("Nombre de la campaña", { exact: true })
      .fill("Pauta octubre - Clases");
    await history
      .getByRole("button", { name: "Guardar nombre", exact: true })
      .click();
    await history.locator(".campaign-name-form").waitFor({ state: "detached" });
    assert(
      (await history.locator(":scope > summary").innerText()).includes(
        "Pauta octubre - Clases",
      ),
    );
    assert.equal(
      await page
        .getByRole("heading", { name: "Clases regulares", exact: true })
        .count(),
      1,
    );
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("gantsta.demo.v4")),
    );
    assert.equal(stored.offerings[0].campaignName, "Pauta octubre - Clases");
    assert.deepEqual(stored.entries, bundle.entries);
    assert.equal(stored.offerings[0].name, "Clases regulares");
    const total = async () =>
      (
        await history.locator(".spend-history-total strong").innerText()
      ).replace(/\s/g, "");
    await history.getByLabel("Consultar fecha").fill("2026-10-02");
    assert.equal(await total(), "40,00€");
    const balances = async () =>
      history
        .locator(".spend-balance-summary")
        .evaluate((element) =>
          Object.fromEntries(
            Array.from(element.querySelectorAll(":scope > div")).map((row) => [
              row.querySelector("dt").textContent,
              row.querySelector("dd").textContent.replace(/\s/g, ""),
            ]),
          ),
        );
    let balance = await balances();
    assert.equal(balance["Gastado antes del periodo"], "30,00€");
    assert.equal(balance["Gasto acumulado hasta 02/10/2026"], "70,00€");
    assert.equal(balance["Saldo al final del periodo"], "230,00€");
    assert.equal(balance["Disponible hoy"], "225,00€");
    assert.equal(await history.locator(".spend-platform-detail").count(), 3);
    await history
      .locator(".spend-platform-detail")
      .first()
      .locator("summary")
      .click();
    assert(
      (
        await history.locator(".spend-platform-days").first().innerText()
      ).includes("02/10/2026"),
    );
    assert(
      (
        await history.locator(".spend-platform-days").first().innerText()
      ).includes("01/10/2026"),
    );
    assert(
      (
        await history.locator(".spend-platform-days").first().innerText()
      ).includes("Anterior al periodo"),
    );
    await history.getByRole("button", { name: "Semana", exact: true }).click();
    assert.equal(await total(), "75,00€");
    assert.equal(
      await history
        .locator(".spend-platform-days")
        .first()
        .locator(".summary-row")
        .count(),
      2,
    );
    await history.getByRole("button", { name: "Mes", exact: true }).click();
    assert.equal(await total(), "75,00€");
    await history.getByRole("button", { name: "Rango", exact: true }).click();
    await history.getByLabel("Hasta", { exact: true }).fill("2026-10-03");
    assert.equal(await total(), "45,00€");
    balance = await balances();
    assert.equal(balance["Gasto acumulado hasta 03/10/2026"], "75,00€");
    assert.equal(balance["Gastado antes del periodo"], "30,00€");
    await history.getByLabel("Hasta", { exact: true }).fill("2026-10-01");
    assert.equal(await history.getByRole("alert").count(), 1);
    assert.equal(await history.locator(".spend-history-total").count(), 0);
    await history.getByLabel("Hasta", { exact: true }).fill("2026-10-03");
    assert.equal(
      await history.evaluate((el) => el.scrollWidth > el.clientWidth),
      false,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await history.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(output, `spending-period-${width}.png`),
      fullPage: true,
    });
    await page.evaluate(() => (location.hash = "#/planning/expense-test"));
    await page
      .getByRole("heading", { name: "Gantt de planificación", exact: true })
      .waitFor();
    assert.equal(await page.locator(".bottom-nav").count(), 1);
    await page.evaluate(() => (location.hash = "#/offering/expense-test"));
    await page.locator(".spend-history").waitFor();
    assert(
      (await page.locator(".spend-history > summary").innerText()).includes(
        "Pauta octubre - Clases",
      ),
    );
    assert.equal(
      await page.locator(".spend-history").getAttribute("open"),
      null,
    );
    assert.deepEqual(errors, []);
    results.push({
      width,
      day: 40,
      week: 75,
      month: 75,
      range: 45,
      planningAvailable: true,
      unifiedPanel: true,
      campaignNameSaved: true,
      overflow: false,
      errors,
    });
    await context.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
