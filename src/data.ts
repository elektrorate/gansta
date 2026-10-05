import type { Bundle, Offering, Entry, Task } from "../shared/model";
import {
  addDays,
  dayCount,
  isoDate,
  today,
  weeklyTargets,
} from "../shared/domain";

function demoTargets(start: string, end: string, goal: number) {
  const firstCount = Math.max(1, Math.round(goal / dayCount(start, end)));
  return [
    { date: start, count: firstCount },
    ...weeklyTargets(start, end, goal).filter((target) => target.date > start),
  ];
}

export function newOffering(ownerId: string): Offering {
  const now = new Date(),
    start = isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return {
    id: crypto.randomUUID(),
    name: "",
    category: "Cursos",
    price: 0,
    billing: "Por inscripción",
    description: "",
    externalUrl: "",
    planningDescription: "",
    start,
    end,
    goal: 20,
    unit: "Inscripciones",
    budgets: { Meta: 0, Google: 0, TikTok: 0 },
    enabledPlatforms: ["Meta"],
    targets: weeklyTargets(start, end, 20),
    ownerId,
    memberIds: [ownerId],
    milestoneDates: [start, addDays(start, 6), addDays(start, 13), end],
    driveUrl: "",
    createdAt: new Date().toISOString(),
  };
}
export function demoData(): Bundle {
  const profiles: Bundle["profiles"] = [
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
  const offerings: Offering[] = [
    ["Clases regulares", "Cursos", 90, 20],
    ["Iniciación al torno", "Cursos", 120, 20],
    ["Modelado creativo", "Cursos", 75, 20],
    ["Cerámica en pareja", "Experiencias", 95, 10],
    ["Taller de cerámica", "Workshops", 65, 12],
    ["Giftcard de cerámica", "Giftcard", 90, 20],
  ].map(([name, category, price, goal], i) => {
    const o = newOffering("demo-admin");
    return {
      ...o,
      id: "demo-" + i,
      name: String(name),
      description:
        i === 0
          ? "Clases prácticas de cerámica para aprender y mejorar tu técnica."
          : "",
      externalUrl: i === 0 ? "https://example.com/clases-regulares" : "",
      planningDescription:
        i === 0
          ? "Diseño y lanzamiento de una campaña de contenido para promocionar las clases regulares."
          : "Plan de trabajo del offering y seguimiento de sus tareas.",
      category: category as Offering["category"],
      price: Number(price) * 100,
      goal: Number(goal),
      budgets: { Meta: 15000, Google: 10000, TikTok: 5000 },
      enabledPlatforms: ["Meta", "Google", "TikTok"],
      memberIds: profiles.map((p) => p.id),
      targets: demoTargets(o.start, o.end, Number(goal)),
    };
  });
  const entries: Bundle["entries"] = {},
    tasks: Bundle["tasks"] = {};
  offerings.forEach((o, i) => {
    const closed = [8, 15, 17, 6, 12, 5][i],
      queries = [40, 52, 48, 22, 36, 16][i],
      spent = [12000, 18500, 16000, 7000, 14500, 2500][i],
      days = dayCount(o.start, today());
    const es: Entry[] = [];
    for (let j = 0; j < Math.min(days, 7); j++) {
      const n = Math.min(days, 7),
        date = addDays(today(), j - n + 1);
      es.push({
        id: date + "_Meta",
        date,
        platform: "Meta",
        queries:
          Math.floor((queries * (j + 1)) / n) - Math.floor((queries * j) / n),
        closed:
          Math.floor((closed * (j + 1)) / n) - Math.floor((closed * j) / n),
        spent: Math.floor((spent * (j + 1)) / n) - Math.floor((spent * j) / n),
      });
    }
    entries[o.id] = es;
    const names = [
      "Definir objetivo y presupuesto",
      "Diseñar anuncios",
      "Configurar campaña",
      "Revisar resultados",
      "Preparar informe final",
    ];
    tasks[o.id] = names.map((title, j): Task => ({
      id: crypto.randomUUID(),
      title,
      milestone: [0, 1, 2, 2, 3][j],
      ownerId: profiles[[0, 1, 2, 2, 0][j]].id,
      ownerName: profiles[[0, 1, 2, 2, 0][j]].name,
      start: addDays(o.start, [0, 1, 7, 13, 24][j]),
      end: addDays(o.start, [0, 6, 13, 20, 27][j]),
      blocked: false,
      status: j < 2 ? "completed" : j === 2 ? "in_progress" : "pending",
      priority: j === 2 ? "high" : "medium",
      predecessorIds: j === 2 ? [] : j === 3 ? [crypto.randomUUID()] : [],
      isMilestone: false,
      description:
        j === 0
          ? "Definir el objetivo, audiencia y entregables del trabajo."
          : "",
      subtasks: (j === 2
        ? [
            "Definir público",
            "Cargar creatividades",
            "Configurar presupuesto",
            "Comprobar enlaces",
          ]
        : ["Preparar", "Revisar"]
      ).map((title, k) => ({
        id: crypto.randomUUID(),
        title,
        done: j < 2 || (j === 2 && k < 2),
      })),
    }));
    if (tasks[o.id][2] && tasks[o.id][3])
      tasks[o.id][3].predecessorIds = [tasks[o.id][2].id];
    tasks[o.id].forEach((task, index) => {
      task.color = (["blue", "violet", "orange", "blue", "green"] as const)[
        index
      ];
      const duration = dayCount(task.start, task.end);
      task.subtasks = task.subtasks.map((sub, i) => ({
        ...sub,
        start: addDays(
          task.start,
          Math.floor((duration * i) / task.subtasks.length),
        ),
        end: addDays(
          task.start,
          Math.max(
            Math.floor((duration * i) / task.subtasks.length),
            Math.floor((duration * (i + 1)) / task.subtasks.length) - 1,
          ),
        ),
        ownerId: task.ownerId,
        progress: sub.done ? 100 : 0,
        status: sub.done ? "completed" : "pending",
      }));
    });
  });
  return { offerings, entries, tasks, profiles };
}
