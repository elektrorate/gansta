import { useRef, useState } from "react";
import type { Offering, Subtask, Task } from "../shared/model";
import { canEditTask, shortDate, taskState, today } from "../shared/domain";
import {
  dependencyWarnings,
  milestoneItems,
  periodFor,
  shiftPeriod,
  subtaskProgress,
  taskRows,
  taskStatus,
  type PlanningMode,
} from "../shared/planning";
import { Back, Empty, ErrorText } from "./ui";
import { useStore } from "./store";
import { PlanningTimeline, planStatusLabels } from "./PlanningTimeline";
import { PlanningTaskCard } from "./PlanningTaskCard";
import { TaskEditor } from "./PlanningEditor";
import { PlanningSettings } from "./PlanningSettings";
import "./planning.css";

export function Planning({ offering: o }: { offering: Offering }) {
  const ganttRef = useRef<HTMLElement>(null);
  const { bundle, profile, saveTask, saveOffering } = useStore(),
    tasks = bundle.tasks[o.id] || [],
    admin = profile?.role === "admin";
  const current = today(),
    initial = current >= o.start && current <= o.end ? current : o.start;
  const [mode, setMode] = useState<PlanningMode>("month"),
    [reference, setReference] = useState(initial);
  const [expanded, setExpanded] = useState<Set<string>>(
    () =>
      new Set(
        taskRows(tasks)
          .slice(0, 1)
          .map((row) => row.id),
      ),
  );
  const [selectedTask, setSelectedTask] = useState<string | null>(null),
    [milestoneFilter, setMilestoneFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all"),
    [ownerFilter, setOwnerFilter] = useState("all");
  const [editing, setEditing] = useState<Task | null>(null),
    [settings, setSettings] = useState(false),
    [showAlerts, setShowAlerts] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const period = periodFor(reference, mode),
    allOrdered = taskRows(tasks).map((row) =>
      tasks.find((task) => task.id === row.id)!,
    );
  const filtered = allOrdered.filter(
    (task) =>
      task.start <= period.end &&
      task.end >= period.start &&
      (statusFilter === "all" || taskStatus(task) === statusFilter) &&
      (ownerFilter === "all" || task.ownerId === ownerFilter) &&
      (milestoneFilter === null || task.milestone === milestoneFilter),
  );
  const milestones = milestoneItems(o, tasks);
  const nextMilestone = milestones
    .filter((item) => !item.completed && item.date >= current)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const alerts = allOrdered.flatMap((task) => [
    ...(taskStatus(task) === "blocked" ? [`${task.title}: bloqueada.`] : []),
    ...(task.end < current && taskStatus(task) !== "completed"
      ? [`${task.title}: vencida.`]
      : []),
    ...dependencyWarnings(task, tasks),
  ]);
  const completed = filtered.filter(
      (task) => taskStatus(task) === "completed",
    ).length,
    blocked = filtered.filter((task) => taskStatus(task) === "blocked").length;
  const progress = filtered.length
    ? Math.round(
        filtered.reduce((sum, task) => sum + taskState(task).percentage, 0) /
          filtered.length,
      )
    : 0;
  const description =
    o.planningDescription?.trim().split(/\s+/).slice(0, 140).join(" ") ||
    "Organiza las tareas, los responsables y las fechas de la campaña.";

  function expand(id: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function focusTask(id: string) {
    setSelectedTask(id);
    setExpanded((previous) => new Set([...previous, id]));
    requestAnimationFrame(() => {
      const card = document.getElementById("plan-task-" + id);
      card?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      card?.focus({ preventScroll: true });
    });
  }
  function selectMilestone(index: number) {
    setMilestoneFilter((previous) => (previous === index ? null : index));
    setReference(milestones[index].date);
    setStatusFilter("all");
    setOwnerFilter("all");
    requestAnimationFrame(() => {
      ganttRef.current?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      ganttRef.current?.focus({ preventScroll: true });
    });
  }
  async function persist(task: Task) {
    await saveTask(o, { ...task, updatedAt: new Date().toISOString() });
  }
  async function changeSubtask(task: Task, index: number, sub: Subtask) {
    setBusy(true);
    setError("");
    try {
      const subtasks = task.subtasks.map((item, i) =>
          i === index ? sub : item,
        ),
        value = Math.round(
          subtasks.reduce((sum, item) => sum + subtaskProgress(item), 0) /
            subtasks.length,
        );
      await persist({
        ...task,
        subtasks,
        progress: value,
        status:
          task.blocked || task.status === "blocked"
            ? "blocked"
            : value === 100
              ? "completed"
              : value > 0
                ? "in_progress"
                : "pending",
      });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function complete(task: Task) {
    setBusy(true);
    setError("");
    try {
      await persist({
        ...task,
        blocked: false,
        status: "completed",
        progress: 100,
        subtasks: task.subtasks.map((sub) => ({
          ...sub,
          done: true,
          status: "completed",
          progress: 100,
        })),
      });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function createTask() {
    const date =
      reference >= o.start && reference <= o.end ? reference : o.start;
    setEditing({
      id: crypto.randomUUID(),
      title: "",
      milestone: 0,
      ownerId: o.ownerId,
      ownerName:
        bundle.profiles.find((person) => person.id === o.ownerId)?.name ||
        "Responsable",
      start: date,
      end: date,
      blocked: false,
      status: "pending",
      priority: "medium",
      color: "violet",
      subtasks: [
        {
          id: crypto.randomUUID(),
          title: "",
          done: false,
          start: date,
          end: date,
          progress: 0,
          status: "pending",
        },
      ],
      predecessorIds: [],
    });
  }
  return (
    <div className="planning-page">
      <Back to={"/offering/" + o.id} label="Offering" />
      <header className="plan-header">
        <div className="row">
          <div>
            <h1>{o.name}</h1>
            <p>
              {shortDate(o.start)} - {shortDate(o.end)}
            </p>
          </div>
          {alerts.length ? (
            <button
              type="button"
              className="plan-icon-button plan-alert-button"
              aria-label={`Ver ${alerts.length} avisos`}
              onClick={() => setShowAlerts(!showAlerts)}
            >
              !
            </button>
          ) : null}
        </div>
        {o.campaignName ? (
          <p className="plan-campaign-name">{o.campaignName}</p>
        ) : null}
        <p className="plan-description">{description}</p>
        {admin ? (
          <button
            type="button"
            className="text-button"
            onClick={() => setSettings(true)}
          >
            Editar planificación
          </button>
        ) : null}
      </header>
      {showAlerts ? (
        <div className="plan-alerts" role="status">
          <h2>Avisos</h2>
          {[...new Set(alerts)].map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}
      <section className="plan-drive">
        <div>
          <h2>Carpeta de Drive</h2>
          <p>Materiales de {o.name}</p>
          {admin ? (
            <button
              type="button"
              className="text-button"
              onClick={() => setSettings(true)}
            >
              {o.driveUrl ? "Cambiar carpeta" : "Vincular carpeta"}
            </button>
          ) : !o.driveUrl ? (
            <p>Sin carpeta vinculada.</p>
          ) : null}
        </div>
        {o.driveUrl ? (
          <a href={o.driveUrl} target="_blank" rel="noopener noreferrer">
            Ver Drive
          </a>
        ) : null}
      </section>
      <section
        className="surface plan-overview"
        ref={ganttRef}
        tabIndex={-1}
        aria-labelledby="plan-gantt-title"
      >
        <div className="plan-overview-header">
          <div>
            <h2 id="plan-gantt-title">Gantt de planificación</h2>
            <p className="small muted">
              Tareas principales, duración y progreso
            </p>
          </div>
          <div
            className="plan-mode-switch"
            role="group"
            aria-label="Escala del Gantt"
          >
            <button
              type="button"
              aria-pressed={mode === "week"}
              onClick={() => setMode("week")}
            >
              Semana
            </button>
            <button
              type="button"
              aria-pressed={mode === "month"}
              onClick={() => setMode("month")}
            >
              Mes
            </button>
          </div>
        </div>
        <div className="plan-period-navigation">
          <button
            type="button"
            aria-label="Periodo anterior"
            onClick={() => setReference(shiftPeriod(reference, mode, -1))}
          >
            ‹
          </button>
          <p aria-live="polite">
            {shortDate(period.start)} - {shortDate(period.end)}
            <small>
              {mode === "month"
                ? new Date(reference + "T12:00:00").toLocaleDateString(
                    "es-ES",
                    { month: "long", year: "numeric" },
                  )
                : "Vista semanal"}
            </small>
          </p>
          <button
            type="button"
            aria-label="Periodo siguiente"
            onClick={() => setReference(shiftPeriod(reference, mode, 1))}
          >
            ›
          </button>
        </div>
        <PlanningTimeline
          rows={taskRows(filtered)}
          start={period.start}
          end={period.end}
          selectedId={selectedTask}
          onSelect={focusTask}
          markers={milestones}
          onMilestone={selectMilestone}
        />
      </section>
      <section className="surface plan-milestones">
        <div className="row">
          <h2>Hitos de la campaña</h2>
          <span className="small muted">4 hitos</span>
        </div>
        <div className="plan-milestone-grid">
          {milestones.map((item) => (
            <button
              type="button"
              className={
                "plan-milestone " +
                (item.completed ? "completed " : "") +
                (milestoneFilter === item.index ? "selected" : "")
              }
              key={item.index}
              aria-pressed={milestoneFilter === item.index}
              onClick={() => selectMilestone(item.index)}
            >
              <i />
              <span>
                <strong>{item.name}</strong>
                <small>
                  {shortDate(item.date)} ·{" "}
                  {item.completed ? "Completado" : "Pendiente"}
                </small>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="plan-period-summary" aria-live="polite">
        <div>
          <strong>{progress}%</strong>
          <span>Progreso del periodo</span>
        </div>
        <div>
          <strong>{filtered.length}</strong>
          <span>Tareas</span>
        </div>
        <div>
          <strong>{completed}</strong>
          <span>Completadas</span>
        </div>
        <div>
          <strong>{blocked}</strong>
          <span>Bloqueadas</span>
        </div>
        {nextMilestone ? (
          <p>
            Próximo hito: <b>{nextMilestone.name}</b> ·{" "}
            {shortDate(nextMilestone.date)}
          </p>
        ) : null}
      </section>
      <div className="plan-list-header">
        <div>
          <h2>Tareas del periodo</h2>
          <p>
            {filtered.length} tareas · {shortDate(period.start)} -{" "}
            {shortDate(period.end)}
          </p>
        </div>
        {admin ? (
          <button type="button" className="secondary" onClick={createTask}>
            + Nueva tarea
          </button>
        ) : null}
      </div>
      <div className="plan-filters">
        <label>
          <span>Estado</span>
          <select
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">Todos los estados</option>
            {Object.entries(planStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Responsable</span>
          <select
            aria-label="Filtrar por responsable"
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
          >
            <option value="all">Todos los responsables</option>
            {bundle.profiles
              .filter((person) => o.memberIds.includes(person.id))
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      {milestoneFilter !== null ? (
        <button
          type="button"
          className="text-button plan-clear-filter"
          onClick={() => setMilestoneFilter(null)}
        >
          Hito: {milestones[milestoneFilter].name} · Ver todas las tareas
        </button>
      ) : null}
      <ErrorText error={error} />
      <div className="plan-task-list">
        {filtered.map((task) => (
          <PlanningTaskCard
            key={task.id}
            task={task}
            tasks={tasks}
            profiles={bundle.profiles}
            expanded={expanded.has(task.id)}
            selected={selectedTask === task.id}
            canEdit={Boolean(profile && canEditTask(profile, o, task))}
            busy={busy}
            onExpand={() => expand(task.id)}
            onEdit={() => setEditing(task)}
            onSubtaskChange={(index, sub) =>
              void changeSubtask(task, index, sub)
            }
            onComplete={() => void complete(task)}
          />
        ))}
        {!filtered.length ? (
          <Empty>No hay tareas para este periodo o filtro.</Empty>
        ) : null}
      </div>
      {editing ? (
        <TaskEditor
          key={editing.id}
          offering={o}
          task={editing}
          tasks={tasks}
          profiles={bundle.profiles}
          canManage={admin}
          onClose={() => setEditing(null)}
          onSave={async (task) => {
            await persist(task);
            setSelectedTask(task.id);
            setExpanded((previous) => new Set([...previous, task.id]));
            if (task.end < period.start || task.start > period.end)
              setReference(task.start);
            setStatusFilter("all");
            setOwnerFilter("all");
            setMilestoneFilter(null);
          }}
        />
      ) : null}
      {settings ? (
        <PlanningSettings
          offering={o}
          tasks={tasks}
          onClose={() => setSettings(false)}
          onSave={saveOffering}
        />
      ) : null}
    </div>
  );
}
