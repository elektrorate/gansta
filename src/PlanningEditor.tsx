import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  taskState,
  validDate,
  validateTask,
  validateTaskDependencies,
} from "../shared/domain";
import {
  milestones,
  type Offering,
  type Profile,
  type Subtask,
  type Task,
  type TaskStatus,
} from "../shared/model";
import { subtaskProgress } from "../shared/planning";
import { ErrorText, Field } from "./ui";

const statusLabels: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  blocked: "Bloqueada",
};

export function usePlanDialog<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    function focusable() {
      return Array.from(
        dialog!.querySelectorAll<HTMLElement>(
          'button, input:not([type="hidden"]), select, textarea, a[href], [tabindex], [contenteditable="true"]',
        ),
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
          element.getClientRects().length > 0,
      );
    }
    function focusInside() {
      const elements = focusable();
      (
        elements.find((element) =>
          element.hasAttribute("data-plan-autofocus"),
        ) ??
        elements[0] ??
        dialog!
      ).focus();
    }
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0],
          last = elements.at(-1);
        if (!first) {
          event.preventDefault();
          dialog!.focus();
        } else if (!elements.includes(document.activeElement as HTMLElement)) {
          event.preventDefault();
          (event.shiftKey ? last! : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last!.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    function focusin(event: FocusEvent) {
      if (event.target instanceof Node && !dialog!.contains(event.target))
        focusInside();
    }

    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", focusin);
    focusInside();
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", focusin);
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return ref;
}

export function TaskEditor({
  offering,
  task,
  tasks,
  profiles,
  canManage,
  onClose,
  onSave,
}: {
  offering: Offering;
  task: Task;
  tasks: Task[];
  profiles: Profile[];
  canManage: boolean;
  onClose: () => void;
  onSave: (task: Task) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Task>(() => structuredClone(task));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const createdAt = useRef<string | undefined>(undefined);
  const isNew = useRef(!task.title.trim()).current;
  const titleId = useId();
  const dialogRef = usePlanDialog<HTMLDivElement>(() => {
    if (!saving.current) onClose();
  });
  const people = profiles.filter(
    (profile) =>
      offering.memberIds.includes(profile.id) && profile.status === "active",
  );
  const percentage = taskState(draft).percentage;
  const datesInvalid =
    !validDate(draft.start) ||
    !validDate(draft.end) ||
    draft.start < offering.start ||
    draft.end > offering.end ||
    draft.end < draft.start;

  function patch(values: Partial<Task>) {
    if (canManage && !saving.current)
      setDraft((previous) => ({ ...previous, ...values }));
  }

  function withSubtasks(previous: Task, subtasks: Subtask[]): Task {
    const progress = subtasks.length
      ? Math.round(
          subtasks.reduce((sum, sub) => sum + subtaskProgress(sub), 0) /
            subtasks.length,
        )
      : 0;
    const next = {
      ...previous,
      subtasks,
      progress,
      status:
        previous.blocked || previous.status === "blocked"
          ? ("blocked" as const)
          : progress === 100
            ? ("completed" as const)
            : progress > 0 || previous.status === "in_progress"
              ? ("in_progress" as const)
              : ("pending" as const),
    };
    return next;
  }

  function updateSubtask(
    index: number,
    values: Partial<Subtask>,
    fulfillment = false,
  ) {
    if (saving.current || (!canManage && !fulfillment)) return;
    setDraft((previous) => {
      const subtasks = previous.subtasks.map((sub, position) =>
        position === index ? { ...sub, ...values } : sub,
      );
      return fulfillment
        ? withSubtasks(previous, subtasks)
        : { ...previous, subtasks };
    });
  }

  function changeSubtaskStatus(index: number, status: TaskStatus) {
    const sub = draft.subtasks[index];
    const previousProgress = subtaskProgress(sub);
    const progress =
      status === "completed"
        ? 100
        : status === "pending"
          ? 0
          : status === "in_progress" && previousProgress === 100
            ? 50
            : previousProgress;
    updateSubtask(
      index,
      { status, progress, done: status === "completed" },
      true,
    );
  }

  function changeSubtaskProgress(index: number, progress: number) {
    const blocked = draft.subtasks[index].status === "blocked";
    const status = blocked
      ? "blocked"
      : progress === 100
        ? "completed"
        : progress === 0
          ? "pending"
          : "in_progress";
    updateSubtask(
      index,
      { progress, status, done: status === "completed" },
      true,
    );
  }

  function changeTaskStatus(status: TaskStatus) {
    if (saving.current) return;
    setDraft((previous) => {
      if (status === "completed" || status === "pending") {
        return {
          ...previous,
          status,
          blocked: false,
          progress: status === "completed" ? 100 : 0,
          subtasks: previous.subtasks.map((sub) => ({
            ...sub,
            status,
            done: status === "completed",
            progress: status === "completed" ? 100 : 0,
          })),
        };
      }
      return {
        ...previous,
        status,
        blocked: status === "blocked",
        progress: taskState(previous).percentage,
      };
    });
  }

  function addSubtask() {
    if (!canManage || saving.current) return;
    setDraft((previous) =>
      withSubtasks(previous, [
        ...previous.subtasks,
        {
          id: crypto.randomUUID(),
          title: "",
          done: false,
          start: previous.start,
          end: previous.end,
          progress: 0,
          status: "pending",
        },
      ]),
    );
  }

  function removeSubtask(index: number) {
    if (!canManage || saving.current) return;
    setDraft((previous) =>
      withSubtasks(
        previous,
        previous.subtasks.filter((_, position) => position !== index),
      ),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    setError("");
    try {
      const next: Task = {
        ...draft,
        title: canManage ? draft.title.trim() : draft.title,
        subtasks: draft.subtasks.map((sub) =>
          canManage ? { ...sub, title: sub.title.trim() } : { ...sub },
        ),
      };
      // Validate raw values before the display helpers can clamp invalid progress.
      validateTask(next, offering);
      validateTaskDependencies(next, tasks);
      next.progress = next.progress ?? taskState(next).percentage;
      const progress = taskState(next).percentage;
      const manuallyBlocked = next.blocked || next.status === "blocked";
      next.status = manuallyBlocked
        ? "blocked"
        : progress === 100
          ? "completed"
          : progress > 0 || next.status === "in_progress"
            ? "in_progress"
            : "pending";
      next.blocked = manuallyBlocked;
      const now = new Date().toISOString();
      next.updatedAt = now;
      if (isNew) next.createdAt = createdAt.current ??= now;
      saving.current = true;
      setBusy(true);
      await onSave(next);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo guardar la tarea.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <div
      className="plan-sheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="plan-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="plan-sheet-header">
          <div>
            <p>{offering.name}</p>
            <h2 id={titleId}>{isNew ? "Nueva tarea" : "Editar tarea"}</h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar editor de tarea"
            disabled={busy}
            onClick={onClose}
          >
            Cerrar
          </button>
        </header>
        <form onSubmit={submit} noValidate aria-busy={busy}>
          <fieldset disabled={busy}>
            <legend>Datos de la tarea</legend>
            <Field label="Título">
              <input
                value={draft.title}
                maxLength={150}
                required
                readOnly={!canManage}
                data-plan-autofocus={canManage ? "" : undefined}
                onChange={(event) => patch({ title: event.target.value })}
              />
            </Field>
            <div className="columns">
              <Field label="Inicio de la tarea">
                <input
                  type="date"
                  value={draft.start}
                  min={offering.start}
                  max={offering.end}
                  required
                  readOnly={!canManage}
                  aria-invalid={datesInvalid}
                  onChange={(event) => patch({ start: event.target.value })}
                />
              </Field>
              <Field label="Fin de la tarea">
                <input
                  type="date"
                  value={draft.end}
                  min={draft.start || offering.start}
                  max={offering.end}
                  required
                  readOnly={!canManage}
                  aria-invalid={datesInvalid}
                  onChange={(event) => patch({ end: event.target.value })}
                />
              </Field>
            </div>
            <ErrorText
              error={
                datesInvalid
                  ? "Las fechas de la tarea deben estar ordenadas y dentro del periodo del offering."
                  : ""
              }
            />
            <Field label="Responsable">
              <select
                aria-label="Responsable de la tarea"
                value={draft.ownerId}
                disabled={!canManage}
                onChange={(event) =>
                  patch({
                    ownerId: event.target.value,
                    ownerName:
                      people.find(
                        (profile) => profile.id === event.target.value,
                      )?.name ?? "",
                  })
                }
              >
                <option value="">Selecciona un responsable</option>
                {draft.ownerId &&
                !people.some((profile) => profile.id === draft.ownerId) ? (
                  <option value={draft.ownerId}>
                    {draft.ownerName || draft.ownerId}
                  </option>
                ) : null}
                {people.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Descripción">
              <textarea
                value={draft.description ?? ""}
                maxLength={500}
                readOnly={!canManage}
                onChange={(event) => patch({ description: event.target.value })}
              />
            </Field>
            <div className="columns">
              <Field label="Prioridad">
                <select
                  aria-label="Prioridad de la tarea"
                  value={draft.priority ?? "medium"}
                  disabled={!canManage}
                  onChange={(event) =>
                    patch({ priority: event.target.value as Task["priority"] })
                  }
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </Field>
              <Field label="Color">
                <select
                  aria-label="Color de la tarea"
                  value={draft.color ?? "violet"}
                  disabled={!canManage}
                  onChange={(event) =>
                    patch({ color: event.target.value as Task["color"] })
                  }
                >
                  <option value="violet">Violeta</option>
                  <option value="orange">Naranja</option>
                  <option value="blue">Azul</option>
                  <option value="green">Verde</option>
                </select>
              </Field>
              <Field label="Hito asociado">
                <select
                  aria-label="Índice del hito asociado"
                  value={draft.milestone}
                  disabled={!canManage}
                  onChange={(event) =>
                    patch({ milestone: Number(event.target.value) })
                  }
                >
                  {milestones.map((milestone, index) => (
                    <option key={milestone} value={index}>
                      {milestone}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Estado de la tarea">
              <select
                aria-label="Estado de la tarea"
                value={
                  draft.status ??
                  (percentage === 100
                    ? "completed"
                    : percentage > 0
                      ? "in_progress"
                      : "pending")
                }
                data-plan-autofocus={!canManage ? "" : undefined}
                onChange={(event) =>
                  changeTaskStatus(event.target.value as TaskStatus)
                }
              >
                {Object.entries(statusLabels).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <p>
              Progreso de la tarea:{" "}
              <output aria-label="Progreso de la tarea">{percentage}%</output>
            </p>
            {draft.subtasks.some(
              (sub) => sub.status === "blocked" && !sub.done,
            ) && !draft.blocked ? (
              <p className="plan-risk">
                Hay una subtarea bloqueada. Su bloqueo se resolverá al
                desbloquearla.
              </p>
            ) : null}
            <fieldset disabled={!canManage}>
              <legend>Dependencias previas</legend>
              {tasks
                .filter((candidate) => candidate.id !== draft.id)
                .map((candidate) => (
                  <Field
                    key={candidate.id}
                    label={candidate.title || candidate.id}
                  >
                    <input
                      type="checkbox"
                      checked={(draft.predecessorIds ?? []).includes(
                        candidate.id,
                      )}
                      onChange={(event) =>
                        patch({
                          predecessorIds: event.target.checked
                            ? [...(draft.predecessorIds ?? []), candidate.id]
                            : (draft.predecessorIds ?? []).filter(
                                (id) => id !== candidate.id,
                              ),
                        })
                      }
                    />
                  </Field>
                ))}
              {tasks.every((candidate) => candidate.id === draft.id) ? (
                <p>No hay otras tareas disponibles.</p>
              ) : null}
            </fieldset>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>Subtareas</legend>
            {draft.subtasks.map((sub, index) => {
              const start = sub.start ?? draft.start,
                end = sub.end ?? draft.end;
              const invalidDates =
                !validDate(start) ||
                !validDate(end) ||
                start < draft.start ||
                end > draft.end ||
                end < start;
              const invalidProgress =
                sub.progress !== undefined &&
                (!Number.isFinite(sub.progress) ||
                  sub.progress < 0 ||
                  sub.progress > 100);
              const progress = invalidProgress
                ? sub.progress!
                : subtaskProgress(sub);
              const status =
                sub.status === "blocked" && !sub.done
                  ? "blocked"
                  : subtaskProgress(sub) === 100
                    ? "completed"
                    : subtaskProgress(sub) > 0 || sub.status === "in_progress"
                      ? "in_progress"
                      : "pending";
              const name = `subtarea ${index + 1}`;
              return (
                <div
                  className="plan-editor-subtask"
                  key={sub.id ?? `legacy-${index}`}
                >
                  <Field label={`Título de la ${name}`}>
                    <input
                      value={sub.title}
                      maxLength={150}
                      required
                      readOnly={!canManage}
                      onChange={(event) =>
                        updateSubtask(index, { title: event.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label={`Inicio de la ${name}`}
                    hint={
                      sub.start === undefined
                        ? "Hereda el inicio de la tarea."
                        : undefined
                    }
                  >
                    <input
                      type="date"
                      value={start}
                      min={draft.start}
                      max={draft.end}
                      required
                      readOnly={!canManage}
                      aria-invalid={invalidDates}
                      onChange={(event) =>
                        updateSubtask(index, { start: event.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label={`Fin de la ${name}`}
                    hint={
                      sub.end === undefined
                        ? "Hereda el fin de la tarea."
                        : undefined
                    }
                  >
                    <input
                      type="date"
                      value={end}
                      min={start}
                      max={draft.end}
                      required
                      readOnly={!canManage}
                      aria-invalid={invalidDates}
                      onChange={(event) =>
                        updateSubtask(index, { end: event.target.value })
                      }
                    />
                  </Field>
                  <Field label={`Responsable de la ${name}`}>
                    <select
                      aria-label={`Responsable de la ${name}`}
                      value={sub.ownerId ?? ""}
                      disabled={!canManage}
                      onChange={(event) => {
                        if (!canManage || saving.current) return;
                        const ownerId = event.target.value;
                        setDraft((previous) => ({
                          ...previous,
                          subtasks: previous.subtasks.map((item, position) => {
                            if (position !== index) return item;
                            const next = { ...item };
                            if (ownerId) next.ownerId = ownerId;
                            else delete next.ownerId;
                            return next;
                          }),
                        }));
                      }}
                    >
                      <option value="">Heredar responsable de la tarea</option>
                      {sub.ownerId &&
                      !people.some((profile) => profile.id === sub.ownerId) ? (
                        <option value={sub.ownerId}>{sub.ownerId}</option>
                      ) : null}
                      {people.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`Progreso de la ${name} (%)`}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      required
                      value={Number.isFinite(progress) ? progress : ""}
                      aria-invalid={invalidProgress}
                      onChange={(event) =>
                        changeSubtaskProgress(index, event.target.valueAsNumber)
                      }
                    />
                  </Field>
                  <Field label={`Estado de la ${name}`}>
                    <select
                      aria-label={`Estado de la ${name}`}
                      value={status}
                      onChange={(event) =>
                        changeSubtaskStatus(
                          index,
                          event.target.value as TaskStatus,
                        )
                      }
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <ErrorText
                    error={
                      invalidDates
                        ? `Revisa las fechas de la ${name}: deben estar ordenadas y dentro de la tarea.`
                        : ""
                    }
                  />
                  <ErrorText
                    error={
                      invalidProgress
                        ? `El progreso de la ${name} debe ser un número entre 0 y 100.`
                        : ""
                    }
                  />
                  {canManage ? (
                    <button
                      type="button"
                      aria-label={`Eliminar ${name}`}
                      onClick={() => removeSubtask(index)}
                    >
                      Eliminar subtarea
                    </button>
                  ) : null}
                </div>
              );
            })}
            {!draft.subtasks.length ? (
              <p>Añade al menos una subtarea para guardar la tarea.</p>
            ) : null}
            {canManage ? (
              <button
                type="button"
                disabled={draft.subtasks.length >= 50}
                onClick={addSubtask}
              >
                Añadir subtarea
              </button>
            ) : null}
          </fieldset>
          <ErrorText error={error} />
          <footer className="plan-editor-actions">
            <button type="button" disabled={busy} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" disabled={busy}>
              {busy ? "Guardando..." : "Guardar tarea"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
