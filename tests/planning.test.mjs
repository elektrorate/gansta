import test from "node:test";
import assert from "node:assert/strict";
import {
  dayCount,
  shortDate,
  taskState,
  validateTask,
  validateTaskDependencies,
  taskProgressOnly,
} from "../shared/domain.ts";
import {
  periodFor,
  shiftPeriod,
  taskStatus,
  subtaskProgress,
  taskRows,
  subtaskRows,
  timelinePlacement,
  milestoneItems,
  dependencyWarnings,
} from "../shared/planning.ts";

const task = (overrides = {}) => ({
  id: "parent",
  title: "Preparar material",
  start: "2026-10-01",
  end: "2026-10-25",
  milestone: 1,
  ownerId: "ana",
  ownerName: "Ana",
  blocked: false,
  subtasks: [{ id: "draft", title: "Borrador", done: false }],
  ...overrides,
});
const row = (overrides = {}) => taskRows([task(overrides)])[0];

test("Subtareas: fechas propias dentro del padre, responsables y progreso válidos", () => {
  const project = {
    start: "2026-10-01",
    end: "2026-10-31",
    memberIds: ["ana", "carlos"],
  };
  const item = task({
    subtasks: [
      {
        id: "a",
        title: "Parte A",
        done: false,
        start: "2026-10-02",
        end: "2026-10-04",
        ownerId: "carlos",
        progress: 64,
        status: "in_progress",
      },
      { id: "b", title: "Parte B", done: false, progress: 30 },
    ],
  });
  assert.doesNotThrow(() => validateTask(item, project));
  assert.equal(taskState(item).percentage, 47);
  assert.throws(
    () =>
      validateTask(
        { ...item, subtasks: [{ ...item.subtasks[0], end: "2026-10-26" }] },
        project,
      ),
    /subtareas/,
  );
  assert.throws(
    () =>
      validateTask(
        {
          ...item,
          subtasks: [
            { ...item.subtasks[0], start: "2026-10-10", end: "2026-10-09" },
          ],
        },
        project,
      ),
    /subtareas/,
  );
  assert.throws(
    () =>
      validateTask(
        { ...item, subtasks: [{ ...item.subtasks[0], progress: 101 }] },
        project,
      ),
    /subtareas/,
  );
  assert.throws(
    () =>
      validateTask(
        { ...item, subtasks: [{ ...item.subtasks[0], ownerId: "outsider" }] },
        project,
      ),
    /subtareas/,
  );
  assert.equal(
    taskStatus({
      ...item,
      subtasks: [{ ...item.subtasks[0], status: "blocked" }],
    }),
    "blocked",
  );
});

test("Dependencias: rechaza ciclos e identificadores fuera del proyecto", () => {
  const a = task({ id: "a", predecessorIds: ["b"] }),
    b = task({ id: "b", predecessorIds: [] });
  assert.doesNotThrow(() => validateTaskDependencies(a, [b]));
  assert.throws(
    () => validateTaskDependencies(a, [{ ...b, predecessorIds: ["a"] }]),
    /ciclo/,
  );
  assert.throws(
    () =>
      validateTaskDependencies({ ...a, predecessorIds: ["other-project"] }, [
        b,
      ]),
    /offering/,
  );
});

test("Colaborador cambia cumplimiento de subtareas pero no fechas ni responsables", () => {
  const initial = task({
    subtasks: [
      {
        id: "a",
        title: "Parte A",
        done: false,
        start: "2026-10-01",
        end: "2026-10-05",
        ownerId: "ana",
      },
    ],
  });
  assert(
    taskProgressOnly(initial, {
      ...initial,
      progress: 50,
      subtasks: [
        { ...initial.subtasks[0], progress: 50, status: "in_progress" },
      ],
    }),
  );
  assert(
    !taskProgressOnly(initial, {
      ...initial,
      subtasks: [{ ...initial.subtasks[0], end: "2026-10-06" }],
    }),
  );
  assert(
    !taskProgressOnly(initial, {
      ...initial,
      subtasks: [{ ...initial.subtasks[0], ownerId: "carlos" }],
    }),
  );
});
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("Semana de lunes a domingo, siete etiquetas y cruce de mes y ano", () => {
  const period = periodFor("2026-10-04", "week");
  assert.deepEqual(period, {
    start: "2026-09-28",
    end: "2026-10-04",
    labels: [
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ].map(shortDate),
  });
  assert.equal(periodFor("2026-10-05", "week").start, "2026-10-05");
  assert.equal(periodFor("2027-01-01", "week").start, "2026-12-28");
  assert.equal(periodFor("2027-01-01", "week").end, "2027-01-03");
});

test("Meses reales de 31, 30, 29 y 28 dias, con etiquetas cada siete dias", () => {
  for (const [date, end, days] of [
    ["2026-10-15", "2026-10-31", 31],
    ["2026-04-15", "2026-04-30", 30],
    ["2024-02-15", "2024-02-29", 29],
    ["2025-02-15", "2025-02-28", 28],
  ]) {
    const period = periodFor(date, "month");
    assert.equal(period.start, date.slice(0, 8) + "01");
    assert.equal(period.end, end);
    assert.equal(dayCount(period.start, period.end), days);
    assert.deepEqual(
      period.labels,
      [1, 8, 15, 22, 29]
        .filter((day) => day <= days)
        .map((day) =>
          shortDate(date.slice(0, 8) + String(day).padStart(2, "0")),
        ),
    );
  }
});

test("Cambio de periodo conserva el dia o lo limita al ultimo dia del mes", () => {
  assert.equal(shiftPeriod("2026-10-04", "week", 1), "2026-10-11");
  assert.equal(shiftPeriod("2026-10-04", "week", -2), "2026-09-20");
  assert.equal(shiftPeriod("2024-01-31", "month", 1), "2024-02-29");
  assert.equal(shiftPeriod("2025-01-31", "month", 1), "2025-02-28");
  assert.equal(shiftPeriod("2026-03-31", "month", -1), "2026-02-28");
  assert.equal(shiftPeriod("2026-12-15", "month", 2), "2027-02-15");
  assert.equal(shiftPeriod("2024-02-29", "month", 12), "2025-02-28");
  assert.equal(shiftPeriod("2026-10-31", "month", 0), "2026-10-31");
});

test("Estados de tarea respetan taskState y el bloqueo tiene prioridad", () => {
  assert.equal(taskStatus(task()), "pending");
  assert.equal(taskStatus(task({ progress: 64 })), "in_progress");
  assert.equal(taskStatus(task({ progress: 100 })), "completed");
  assert.equal(
    taskStatus(task({ status: "in_progress", progress: 0 })),
    "in_progress",
  );
  assert.equal(
    taskStatus(task({ status: "pending", progress: 100 })),
    "pending",
  );
  assert.equal(
    taskStatus(task({ status: "completed", progress: 0 })),
    "completed",
  );
  assert.equal(
    taskStatus(task({ blocked: true, status: "completed" })),
    "blocked",
  );
  assert.equal(
    taskStatus(task({ status: "blocked", progress: 100 })),
    "blocked",
  );
  assert.equal(
    taskStatus(task({ subtasks: [{ title: "Lista", done: true }] })),
    "completed",
  );
});

test("Progreso de subtarea: done y completed, pending, limites y valores no finitos", () => {
  for (const [sub, expected] of [
    [{ done: true, status: "pending", progress: 0 }, 100],
    [{ status: "completed", progress: 0 }, 100],
    [{ status: "pending", progress: 64 }, 0],
    [{ progress: 64 }, 64],
    [{ progress: -10 }, 0],
    [{ progress: 150 }, 100],
    [{ progress: NaN }, 0],
    [{ progress: Infinity }, 0],
    [{}, 0],
  ])
    assert.equal(
      subtaskProgress({ title: "Paso", done: false, ...sub }),
      expected,
    );
});

test("Gantt general solo contiene tareas principales ordenadas por inicio, fin e id", () => {
  const tasks = [
    task({ id: "z", end: "2026-10-09" }),
    task({ id: "b", end: "2026-10-07", color: "orange", progress: 64 }),
    task({ id: "child", parentId: "b" }),
    task({ id: "a", end: "2026-10-07" }),
    task({
      id: "first",
      start: "2026-09-30",
      subtasks: [{ title: "Lista", done: true }],
    }),
  ];
  const original = structuredClone(tasks);
  const rows = taskRows(tasks);
  assert.deepEqual(
    rows.map((item) => item.id),
    ["first", "a", "b", "z"],
  );
  assert.equal(rows[0].progress, 100);
  assert.equal(rows[0].status, "completed");
  assert.equal(rows[1].color, "violet");
  assert.equal(rows[2].color, "orange");
  assert.equal(rows[2].progress, 64);
  assert.equal(rows[2].ownerName, "Ana");
  assert.deepEqual(tasks, original);
});

test("Mini Gantt aislado: solo subtareas de su tarjeta, sin padre ni otras tareas", () => {
  const first = task();
  const second = task({
    id: "other",
    subtasks: [{ id: "draft", title: "Otro borrador", done: true }],
  });
  assert.deepEqual(
    subtaskRows(first).map((item) => item.id),
    ["parent:draft"],
  );
  assert.deepEqual(
    subtaskRows(second).map((item) => item.id),
    ["other:draft"],
  );
  assert.deepEqual(subtaskRows(task({ subtasks: [] })), []);
  assert.equal(subtaskRows(first)[0].title, "Borrador");
  const reversed = task({
    subtasks: [
      { id: "two", title: "Dos", done: false },
      ...first.subtasks,
    ].reverse(),
  });
  assert.equal(subtaskRows(reversed)[0].id, "parent:draft");
});

test("Subtareas heredan solo fechas ausentes, responsable y color del padre", () => {
  const parent = task({
    color: "blue",
    blocked: true,
    subtasks: [
      { title: "Sin fechas", done: false },
      {
        id: "start",
        title: "Inicio propio",
        done: false,
        start: "2026-10-05",
        ownerId: "bea",
        progress: 64,
      },
      {
        id: "end",
        title: "Fin propio",
        done: false,
        end: "2026-10-10",
        status: "blocked",
      },
      {
        id: "own",
        title: "Fechas propias",
        done: true,
        start: "2026-10-07",
        end: "2026-10-08",
        status: "pending",
      },
    ],
  });
  const original = structuredClone(parent);
  const rows = subtaskRows(parent, [{ id: "bea", name: "Bea" }]);
  assert.deepEqual(
    rows.map(({ id, start, end, inheritedDates }) => ({
      id,
      start,
      end,
      inheritedDates,
    })),
    [
      {
        id: "parent:0",
        start: parent.start,
        end: parent.end,
        inheritedDates: true,
      },
      {
        id: "parent:start",
        start: "2026-10-05",
        end: parent.end,
        inheritedDates: true,
      },
      {
        id: "parent:end",
        start: parent.start,
        end: "2026-10-10",
        inheritedDates: true,
      },
      {
        id: "parent:own",
        start: "2026-10-07",
        end: "2026-10-08",
        inheritedDates: false,
      },
    ],
  );
  assert.deepEqual(
    rows.map((item) => item.status),
    ["pending", "in_progress", "blocked", "completed"],
  );
  assert.equal(rows[0].ownerName, "Ana");
  assert.equal(rows[1].ownerName, "Bea");
  assert.equal(rows[1].progress, 64);
  assert.ok(rows.every((item) => item.color === "blue"));
  assert.equal(
    subtaskRows(
      task({
        subtasks: [{ title: "Asignada", done: false, ownerId: "unknown" }],
      }),
    )[0].ownerName,
    undefined,
  );
  assert.deepEqual(parent, original);
});

test("Colocacion inclusiva: un dia, extremos y semana completa sin ancho minimo", () => {
  const start = "2026-10-05",
    end = "2026-10-11";
  const full = timelinePlacement(row({ start, end, progress: 64 }), start, end);
  assert.deepEqual(full, {
    visible: true,
    left: 0,
    width: 100,
    fill: 64,
    continuesBefore: false,
    continuesAfter: false,
  });
  for (const [date, left] of [
    [start, 0],
    [end, 600 / 7],
  ]) {
    const placed = timelinePlacement(
      row({ start: date, end: date, progress: 100 }),
      start,
      end,
    );
    assert.equal(placed.visible, true);
    close(placed.left, left);
    close(placed.width, 100 / 7);
    assert.equal(placed.fill, 100);
  }
});

test("Progreso 64% se recorta desde los 25 dias totales, no se reinicia en la ventana", () => {
  const item = row({ progress: 64 });
  assert.deepEqual(timelinePlacement(item, "2026-10-11", "2026-10-20"), {
    visible: true,
    left: 0,
    width: 100,
    fill: 60,
    continuesBefore: true,
    continuesAfter: true,
  });
  assert.equal(timelinePlacement(item, "2026-10-10", "2026-10-16").fill, 100);
  assert.equal(timelinePlacement(item, "2026-10-17", "2026-10-25").fill, 0);
  const after = timelinePlacement(item, "2026-10-20", "2026-10-31");
  close(after.width, 50);
  assert.equal(after.fill, 0);
  assert.equal(after.continuesAfter, false);
  const before = timelinePlacement(item, "2026-09-28", "2026-10-04");
  close(before.left, 300 / 7);
  close(before.width, 400 / 7);
  assert.equal(before.fill, 100);
  assert.equal(before.continuesBefore, false);
  assert.equal(before.continuesAfter, true);
});

test("Colocacion mensual usa 31 o 29 dias y mantiene progreso fraccional", () => {
  const placed = timelinePlacement(
    row({ start: "2026-10-31", end: "2026-10-31" }),
    "2026-10-01",
    "2026-10-31",
  );
  close(placed.left, 3000 / 31);
  close(placed.width, 100 / 31);
  const leap = timelinePlacement(
    row({ start: "2024-02-29", end: "2024-02-29", progress: 64 }),
    "2024-02-01",
    "2024-02-29",
  );
  close(leap.left, 2800 / 29);
  close(leap.width, 100 / 29);
  close(leap.fill, 64);
  const partial = timelinePlacement(
    row({ start: "2026-10-01", end: "2026-10-31", progress: 64 }),
    "2026-10-15",
    "2026-10-21",
  );
  close(partial.fill, ((31 * 0.64 - 14) / 7) * 100);
});

test("Rango ancho mantiene ancho exacto de un dia y no limita la duracion", () => {
  const start = "2020-01-01",
    end = "2030-12-31";
  const placed = timelinePlacement(
    row({ start: "2024-02-29", end: "2024-02-29" }),
    start,
    end,
  );
  close(placed.width, 100 / dayCount(start, end));
  close(
    placed.left,
    ((dayCount(start, "2024-02-29") - 1) / dayCount(start, end)) * 100,
  );
  assert.ok(placed.width < 0.1);
});

test("Fuera de rango o fechas invalidas producen geometria oculta y finita", () => {
  for (const [item, start, end] of [
    [
      row({ end: "2026-10-04", start: "2026-10-01" }),
      "2026-10-05",
      "2026-10-11",
    ],
    [row({ start: "2026-10-12" }), "2026-10-05", "2026-10-11"],
    [row(), "2026-10-11", "2026-10-05"],
    [row({ start: "2026-10-26" }), "2026-10-01", "2026-10-31"],
    [row({ start: "2026-02-30" }), "2026-10-01", "2026-10-31"],
    [row(), "", "2026-10-31"],
  ])
    assert.deepEqual(timelinePlacement(item, start, end), {
      visible: false,
      left: 0,
      width: 0,
      fill: 0,
      continuesBefore: false,
      continuesAfter: false,
    });
  for (const [progress, fill] of [
    [-1, 0],
    [101, 100],
    [NaN, 0],
  ]) {
    assert.equal(
      timelinePlacement({ ...row(), progress }, "2026-10-01", "2026-10-25")
        .fill,
      fill,
    );
  }
});

const offering = {
  milestoneDates: ["2020-01-01", "2020-01-08", "2020-01-15", "2020-01-31"],
};

test("Confirmar un hito no congela los estados automáticos de los demás", () => {
  const mixed = { ...offering, milestoneCompleted: [true, null, null, null] };
  assert.deepEqual(
    milestoneItems(mixed, [task({ milestone: 2, progress: 100 })]).map(
      (item) => item.completed,
    ),
    [true, false, true, false],
  );
});

test("Cuatro hitos: fechas pasadas nunca completan hitos sin tareas o incompletos", () => {
  const items = milestoneItems(offering, [
    task({ milestone: 1 }),
    task({ milestone: 2, progress: 100 }),
  ]);
  assert.deepEqual(
    items.map((item) => item.completed),
    [false, false, true, false],
  );
  assert.deepEqual(
    items.map((item) => item.index),
    [0, 1, 2, 3],
  );
  assert.deepEqual(
    items.map((item) => item.date),
    offering.milestoneDates,
  );
  assert.equal(items[0].name, "Inicio");
  assert.equal(
    milestoneItems(offering, [
      task({ milestone: 2, status: "completed" }),
      task({ milestone: 2 }),
    ])[2].completed,
    false,
  );
  assert.equal(
    milestoneItems(offering, [
      task({ milestone: 2, blocked: true, progress: 100 }),
    ])[2].completed,
    false,
  );
});

test("Estado manual de los cuatro hitos prevalece incluso cuando es false", () => {
  const manual = {
    ...offering,
    milestoneCompleted: [true, false, false, true],
  };
  assert.deepEqual(
    milestoneItems(manual, [
      task({ milestone: 1, status: "completed" }),
      task({ milestone: 2, progress: 100 }),
    ]).map((item) => item.completed),
    manual.milestoneCompleted,
  );
});

test("Dependencias incompletas, bloqueadas, vencidas y solapadas incluyen nombre legible", () => {
  const predecessor = task({
    id: "pre",
    title: "Aprobar material",
    end: "2026-10-05",
    blocked: true,
  });
  const dependent = task({
    start: "2026-10-05",
    predecessorIds: ["pre", "missing-id"],
  });
  const warnings = dependencyWarnings(dependent, [predecessor], "2026-10-06");
  assert.ok(
    warnings.some((warning) => /Aprobar material.*bloqueada/.test(warning)),
  );
  assert.ok(
    warnings.some((warning) => /Aprobar material.*vencida/.test(warning)),
  );
  assert.ok(
    warnings.some((warning) => /Aprobar material.*solapan/.test(warning)),
  );
  assert.ok(warnings.some((warning) => warning.includes("missing-id")));
  assert.ok(
    dependencyWarnings(
      dependent,
      [{ ...predecessor, blocked: false }],
      "2026-10-05",
    ).some((warning) => /incompleta/.test(warning)),
  );
  assert.ok(
    !dependencyWarnings(dependent, [predecessor], "2026-10-05").some(
      (warning) => /vencida/.test(warning),
    ),
  );
});

test("Dependencias completas no son vencidas; fechas inclusivas aun detectan solapamiento", () => {
  const predecessor = task({
    id: "pre",
    status: "completed",
    end: "2026-10-05",
  });
  assert.deepEqual(
    dependencyWarnings(
      task({ start: "2026-10-06", predecessorIds: ["pre"] }),
      [predecessor],
      "2026-10-10",
    ),
    [],
  );
  const warnings = dependencyWarnings(
    task({ start: "2026-10-05", predecessorIds: ["pre"] }),
    [predecessor],
    "2026-10-10",
  );
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /solapan/);
  assert.deepEqual(dependencyWarnings(task(), [predecessor]), []);
});
