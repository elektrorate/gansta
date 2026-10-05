import type { CSSProperties } from "react";
import type { Profile, Subtask, Task } from "../shared/model";
import { shortDate, taskState, today } from "../shared/domain";
import {
  dependencyWarnings,
  subtaskProgress,
  subtaskRows,
  taskStatus,
} from "../shared/planning";
import {
  PlanningTimeline,
  planColors,
  planStatusLabels,
} from "./PlanningTimeline";

const priorityLabels = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

export function PlanningTaskCard({
  task,
  tasks,
  profiles,
  expanded,
  selected,
  canEdit,
  busy,
  onExpand,
  onEdit,
  onSubtaskChange,
  onComplete,
}: {
  task: Task;
  tasks: Task[];
  profiles: Profile[];
  expanded: boolean;
  selected: boolean;
  canEdit: boolean;
  busy: boolean;
  onExpand: () => void;
  onEdit: () => void;
  onSubtaskChange: (index: number, sub: Subtask) => void;
  onComplete: () => void;
}) {
  const status = taskStatus(task),
    progress = taskState(task).percentage,
    rows = subtaskRows(task, profiles),
    warnings = dependencyWarnings(task, tasks);
  return (
    <article
      id={"plan-task-" + task.id}
      data-task-id={task.id}
      className={"plan-task-card " + (selected ? "selected" : "")}
      tabIndex={-1}
      style={
        { "--plan-accent": planColors[task.color || "violet"] } as CSSProperties
      }
    >
      <div className="plan-task-top">
        <button
          type="button"
          className="plan-expand-button"
          aria-expanded={expanded}
          aria-controls={"plan-body-" + task.id}
          aria-label={`${expanded ? "Contraer" : "Expandir"} ${task.title}`}
          onClick={onExpand}
        >
          {expanded ? "−" : "+"}
        </button>
        <div className="plan-task-title">
          <h3>
            <i className={"plan-status-dot " + status} />
            {task.title}
          </h3>
          <p>
            {shortDate(task.start)} - {shortDate(task.end)} · {task.ownerName}
          </p>
        </div>
        <span className={"plan-state " + status}>
          {planStatusLabels[status]}
        </span>
      </div>
      <div className="plan-progress-line">
        <div
          className="plan-progress"
          role="progressbar"
          aria-label={`Progreso de ${task.title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <b>{progress}%</b>
      </div>
      {expanded ? (
        <div className="plan-task-body" id={"plan-body-" + task.id}>
          <div className="plan-task-meta">
            <span>
              Prioridad: <b>{priorityLabels[task.priority || "medium"]}</b>
            </span>
            <span>
              {taskState(task).count}/{task.subtasks.length} subtareas
            </span>
          </div>
          {task.description ? (
            <p className="plan-task-description">{task.description}</p>
          ) : null}
          <div className="plan-subtask-list">
            {task.subtasks.map((sub, index) => {
              const row = rows[index];
              return (
                <div
                  className={"plan-subtask " + (sub.done ? "completed" : "")}
                  key={sub.id || index}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={sub.done}
                      disabled={!canEdit || busy}
                      onChange={(event) =>
                        onSubtaskChange(index, {
                          ...sub,
                          done: event.target.checked,
                          progress: event.target.checked ? 100 : 0,
                          status: event.target.checked
                            ? "completed"
                            : "pending",
                        })
                      }
                    />
                    <span>{sub.title}</span>
                  </label>
                  <div className="plan-subtask-info">
                    <span>
                      {shortDate(row.start)} - {shortDate(row.end)} ·{" "}
                      {row.ownerName || "Responsable asignado"}
                    </span>
                    <b>{subtaskProgress(sub)}%</b>
                  </div>
                  {row.status === "blocked" ? (
                    <span className="plan-subtask-warning">Bloqueada</span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="plan-mini-heading">
            <h4>Cronograma de subtareas</h4>
            <span>
              {shortDate(task.start)} - {shortDate(task.end)}
            </span>
          </div>
          <PlanningTimeline
            rows={rows}
            start={task.start}
            end={task.end}
            mini
            onSelect={canEdit ? () => onEdit() : undefined}
          />
          {task.end < today() && status !== "completed" ? (
            <p className="plan-risk">
              Tarea vencida: revisa la fecha de entrega.
            </p>
          ) : null}
          {warnings.length ? (
            <div className="plan-risk">
              <strong>Dependencias</strong>
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
          {canEdit ? (
            <div className="plan-task-actions">
              <button
                type="button"
                className="text-button"
                onClick={onEdit}
                disabled={busy}
              >
                Editar tarea
              </button>
              {status !== "completed" ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={onComplete}
                  disabled={busy}
                >
                  Marcar completada
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
