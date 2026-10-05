import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const output = process.env.VERIFY_OUTPUT || join(tmpdir(), "opencode");
const profiles = [
  {
    id: "demo-admin",
    name: "Ana",
    email: "ana@example.test",
    role: "admin",
    status: "active",
  },
  {
    id: "demo-carlos",
    name: "Carlos",
    email: "carlos@example.test",
    role: "collaborator",
    status: "active",
  },
  {
    id: "demo-laura",
    name: "Laura",
    email: "laura@example.test",
    role: "collaborator",
    status: "active",
  },
];
const project = {
  id: "plan-test",
  name: "Clases regulares",
  campaignName: "Pauta de octubre",
  description: "Curso de cerámica",
  planningDescription:
    "Diseño y lanzamiento de la campaña para las clases regulares.",
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
  memberIds: profiles.map((profile) => profile.id),
  milestoneDates: ["2026-10-01", "2026-10-07", "2026-10-14", "2026-10-31"],
  driveUrl: "",
  createdAt: "2026-10-01",
};
const task = (id, title, start, end, ownerId, milestone, subtasks) => ({
  id,
  title,
  start,
  end,
  ownerId,
  ownerName: profiles.find((profile) => profile.id === ownerId).name,
  milestone,
  subtasks,
  blocked: false,
  color: milestone === 2 ? "orange" : "violet",
  priority: milestone === 2 ? "high" : "medium",
  predecessorIds: [],
});
const tasks = [
  task(
    "goal",
    "Definir objetivo",
    "2026-10-01",
    "2026-10-01",
    "demo-admin",
    0,
    [
      {
        id: "goal-a",
        title: "Objetivo definido",
        done: true,
        start: "2026-10-01",
        end: "2026-10-01",
        progress: 100,
        status: "completed",
      },
    ],
  ),
  task(
    "design",
    "Diseñar anuncios",
    "2026-10-02",
    "2026-10-07",
    "demo-carlos",
    1,
    [
      {
        id: "design-a",
        title: "Boceto",
        done: true,
        start: "2026-10-02",
        end: "2026-10-04",
        progress: 100,
        status: "completed",
      },
      {
        id: "design-b",
        title: "Validación",
        done: false,
        start: "2026-10-05",
        end: "2026-10-07",
        progress: 30,
        status: "in_progress",
      },
    ],
  ),
  task(
    "config",
    "Configurar campaña",
    "2026-10-08",
    "2026-10-14",
    "demo-laura",
    2,
    [
      {
        id: "config-a",
        title: "Público objetivo",
        done: false,
        start: "2026-10-08",
        end: "2026-10-10",
        progress: 20,
        status: "in_progress",
      },
      {
        id: "config-b",
        title: "Presupuesto de pauta",
        done: false,
        start: "2026-10-11",
        end: "2026-10-14",
        progress: 30,
        status: "in_progress",
      },
    ],
  ),
  task("legacy", "Informe final", "2026-10-24", "2026-10-31", "demo-admin", 3, [
    { title: "Recopilar métricas", done: false },
  ]),
];
const bundle = {
  profiles,
  offerings: [project],
  tasks: { "plan-test": tasks },
  entries: {
    "plan-test": [
      {
        id: "2026-10-02_Meta",
        date: "2026-10-02",
        platform: "Meta",
        queries: 10,
        closed: 2,
        spent: 3000,
      },
    ],
  },
};
const results = [];
async function enter(page, data) {
  await page.goto("http://127.0.0.1:8000/");
  await page.evaluate(
    (value) => localStorage.setItem("gantsta.demo.v4", JSON.stringify(value)),
    data,
  );
  await page
    .getByRole("button", { name: "Probar la aplicación con datos de ejemplo" })
    .click();
  await page.evaluate(() => (location.hash = "#/offering/plan-test"));
  await page.getByRole("button", { name: "Ver planificación" }).click();
  await page
    .getByRole("heading", { name: "Gantt de planificación", exact: true })
    .waitFor();
}
try {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await enter(page, bundle);
    assert.equal(
      await page.locator(".plan-main-timeline [data-row-id]").count(),
      4,
    );
    assert.equal(await page.locator(".plan-milestone").count(), 4);
    assert(
      (await page.locator(".plan-milestone").first().innerText()).includes(
        "Completado",
      ),
    );
    assert(
      (await page.locator(".plan-milestone").nth(1).innerText()).includes(
        "Pendiente",
      ),
    );
    await page
      .locator('.plan-main-timeline [data-row-id="design"] .plan-timeline-name')
      .focus();
    await page.keyboard.press("Enter");
    const design = page.locator('.plan-task-card[data-task-id="design"]');
    await design.locator(".plan-mini-timeline").waitFor();
    const miniNames = await design
      .locator(".plan-mini-timeline .plan-timeline-name")
      .allTextContents();
    assert.deepEqual(miniNames, ["Boceto", "Validación"]);
    assert.equal(
      await design.getByRole("progressbar").getAttribute("aria-valuenow"),
      "65",
    );
    await design
      .getByRole("button", { name: "Editar tarea", exact: true })
      .click();
    await page
      .getByLabel("Progreso de la subtarea 1 (%)", { exact: true })
      .fill("50");
    await page
      .getByLabel("Inicio de la tarea", { exact: true })
      .fill("2026-10-03");
    await page
      .getByRole("button", { name: "Guardar tarea", exact: true })
      .click();
    assert(
      await page.getByRole("alert").filter({ hasText: "subtareas" }).count(),
    );
    await page
      .getByLabel("Inicio de la subtarea 1", { exact: true })
      .fill("2026-10-03");
    await page
      .getByRole("button", { name: "Guardar tarea", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(
      await design.getByRole("progressbar").getAttribute("aria-valuenow"),
      "40",
    );
    assert.equal(
      await design
        .locator('[data-row-id="design:design-a"] .plan-duration-fill')
        .evaluate((element) => element.style.width),
      "50%",
    );
    await page.getByRole("button", { name: "Semana", exact: true }).click();
    assert.equal(
      await page.locator(".plan-main-timeline [data-row-id]").count(),
      2,
    );
    assert.deepEqual(
      await design
        .locator(".plan-mini-timeline .plan-timeline-name")
        .allTextContents(),
      miniNames,
    );
    await page.getByRole("button", { name: "Mes", exact: true }).click();
    await page.getByLabel("Filtrar por estado").selectOption("completed");
    assert.equal(
      await page.locator(".plan-main-timeline [data-row-id]").count(),
      1,
    );
    await page.getByLabel("Filtrar por estado").selectOption("all");
    await page
      .getByLabel("Filtrar por responsable")
      .selectOption("demo-carlos");
    assert.equal(await page.locator(".plan-task-card").count(), 1);
    await page.getByLabel("Filtrar por responsable").selectOption("all");
    await page.locator(".plan-milestone").nth(1).click();
    await page.waitForFunction(
      () =>
        Math.abs(
          document.querySelector(".plan-overview").getBoundingClientRect().top -
            16,
        ) < 2,
    );
    const milestoneBoxes = await page
      .locator(".plan-milestone")
      .evaluateAll((buttons) =>
        buttons.map((button) => ({
          top: button.getBoundingClientRect().top,
          height: button.getBoundingClientRect().height,
        })),
      );
    assert.equal(milestoneBoxes[0].top, milestoneBoxes[1].top);
    assert.equal(milestoneBoxes[2].top, milestoneBoxes[3].top);
    assert(milestoneBoxes.every((box) => box.height >= 44));
    assert.equal(await page.locator(".plan-task-card").count(), 1);
    await page.getByRole("button", { name: /Ver todas las tareas/ }).click();
    await page
      .getByRole("button", { name: "Editar planificación", exact: true })
      .click();
    await page
      .getByLabel("Descripción de la planificación")
      .fill("Diseño del reel y publicación de la campaña.");
    await page
      .getByLabel("Carpeta de Drive", { exact: true })
      .fill("https://drive.google.com/drive/folders/project-assets");
    await page.getByLabel("Material completado", { exact: true }).check();
    await page
      .getByRole("button", { name: "Guardar planificación", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(
      await page
        .getByRole("link", { name: "Ver Drive", exact: true })
        .getAttribute("href"),
      "https://drive.google.com/drive/folders/project-assets",
    );
    assert(
      (await page.locator(".plan-milestone").nth(1).innerText()).includes(
        "Completado",
      ),
    );
    const config = page.locator('.plan-task-card[data-task-id="config"]');
    await config
      .getByRole("button", { name: "Expandir Configurar campaña", exact: true })
      .click();
    assert.deepEqual(
      await config
        .locator(".plan-mini-timeline .plan-timeline-name")
        .allTextContents(),
      ["Público objetivo", "Presupuesto de pauta"],
    );
    await config
      .getByRole("button", { name: "Marcar completada", exact: true })
      .click();
    assert.equal(
      await config.getByRole("progressbar").getAttribute("aria-valuenow"),
      "100",
    );
    assert(
      (await page.locator(".plan-milestone").nth(2).innerText()).includes(
        "Completado",
      ),
    );
    await page
      .getByRole("button", { name: "+ Nueva tarea", exact: true })
      .click();
    await page.getByLabel("Título", { exact: true }).fill("Publicar reel");
    await page
      .getByLabel("Inicio de la tarea", { exact: true })
      .fill("2026-10-10");
    await page
      .getByLabel("Fin de la tarea", { exact: true })
      .fill("2026-10-12");
    await page
      .getByLabel("Índice del hito asociado", { exact: true })
      .selectOption("3");
    await page
      .getByLabel("Título de la subtarea 1", { exact: true })
      .fill("Grabar");
    await page
      .getByLabel("Inicio de la subtarea 1", { exact: true })
      .fill("2026-10-10");
    await page
      .getByLabel("Fin de la subtarea 1", { exact: true })
      .fill("2026-10-11");
    await page
      .getByRole("button", { name: "Añadir subtarea", exact: true })
      .click();
    await page
      .getByLabel("Título de la subtarea 2", { exact: true })
      .fill("Publicar");
    await page
      .getByLabel("Inicio de la subtarea 2", { exact: true })
      .fill("2026-10-12");
    await page
      .getByLabel("Fin de la subtarea 2", { exact: true })
      .fill("2026-10-12");
    await page
      .getByRole("button", { name: "Guardar tarea", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(
      await page.locator(".plan-main-timeline [data-row-id]").count(),
      5,
    );
    const reel = page.locator(".plan-task-card").filter({
      has: page.getByRole("heading", { name: "Publicar reel", exact: true }),
    });
    assert.deepEqual(
      await reel
        .locator(".plan-mini-timeline .plan-timeline-name")
        .allTextContents(),
      ["Grabar", "Publicar"],
    );
    const legacy = page.locator('.plan-task-card[data-task-id="legacy"]');
    await legacy
      .getByRole("button", { name: "Expandir Informe final", exact: true })
      .click();
    assert(
      (await legacy.locator(".plan-mini-timeline").innerText()).includes(
        "Sin fechas propias",
      ),
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `Overflow ${width}`,
    );
    assert.equal(
      await page
        .locator(".plan-main-timeline")
        .evaluate((element) => element.scrollWidth > element.clientWidth),
      false,
    );
    await page.screenshot({
      path: join(output, `new-planning-${width}.png`),
      fullPage: true,
    });
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("gantsta.demo.v4")),
    );
    assert.equal(
      stored.tasks["plan-test"].find((task) => task.id === "design").subtasks[0]
        .start,
      "2026-10-03",
    );
    assert.deepEqual(stored.entries, bundle.entries);
    assert.deepEqual(stored.offerings[0].budgets, project.budgets);
    assert.deepEqual(stored.offerings[0].milestoneCompleted, [
      null,
      true,
      null,
      null,
    ]);
    await page.reload();
    await page
      .getByRole("button", {
        name: "Probar la aplicación con datos de ejemplo",
      })
      .click();
    await page
      .getByRole("heading", { name: "Gantt de planificación", exact: true })
      .waitFor();
    assert.equal(
      await page.locator(".plan-main-timeline [data-row-id]").count(),
      5,
    );
    assert.deepEqual(errors, []);
    results.push({
      width,
      isolatedSubtasks: true,
      editing: true,
      creation: true,
      filtering: true,
      drive: true,
      milestones: true,
      persistence: true,
      overflow: false,
      errors,
    });
    await context.close();
  }
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  await enter(page, bundle);
  await page.evaluate(() => (location.hash = "#/account"));
  await page.getByLabel("Probar otro rol").selectOption("demo-carlos");
  await page.evaluate(() => (location.hash = "#/planning/plan-test"));
  await page
    .getByRole("heading", { name: "Gantt de planificación", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "+ Nueva tarea", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Editar planificación", exact: true })
      .count(),
    0,
  );
  await page
    .locator('.plan-main-timeline [data-row-id="design"] .plan-timeline-name')
    .click();
  const card = page.locator('.plan-task-card[data-task-id="design"]');
  await card.getByRole("checkbox", { name: "Boceto", exact: true }).uncheck();
  assert.equal(
    await card.getByRole("progressbar").getAttribute("aria-valuenow"),
    "15",
  );
  await card.getByRole("button", { name: "Editar tarea", exact: true }).click();
  assert.equal(
    await page
      .getByLabel("Inicio de la tarea", { exact: true })
      .evaluate((element) => element.readOnly),
    true,
  );
  assert(
    await page.getByLabel("Color de la tarea", { exact: true }).isDisabled(),
  );
  await page
    .getByLabel("Progreso de la subtarea 2 (%)", { exact: true })
    .fill("50");
  await page
    .getByRole("button", { name: "Guardar tarea", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(
    await card.getByRole("progressbar").getAttribute("aria-valuenow"),
    "25",
  );
  await card.getByRole("button", { name: "Editar tarea", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await card.getByRole("button", { name: "Editar tarea", exact: true }).click();
  await page
    .getByLabel("Estado de la subtarea 2", { exact: true })
    .selectOption("blocked");
  await page
    .getByRole("button", { name: "Guardar tarea", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert((await card.locator(".plan-state").innerText()).includes("Bloqueada"));
  await card.getByRole("button", { name: "Editar tarea", exact: true }).click();
  await page
    .getByLabel("Estado de la subtarea 2", { exact: true })
    .selectOption("in_progress");
  await page
    .getByRole("button", { name: "Guardar tarea", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert((await card.locator(".plan-state").innerText()).includes("En curso"));
  results.push({
    collaboratorProgress: true,
    structureProtected: true,
    escapeClosesEditor: true,
  });
  await context.close();
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
