import type { CSSProperties } from "react";
import {
  addDays,
  dayCount,
  parseDate,
  shortDate,
  today,
} from "../shared/domain";
import { timelinePlacement, type TimelineRow } from "../shared/planning";

export const planStatusLabels = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  blocked: "Bloqueada",
};
export const planColors = {
  violet: "#6955d7",
  orange: "#b66816",
  blue: "#3677bf",
  green: "#247c61",
};

export function PlanningTimeline({
  rows,
  start,
  end,
  mini = false,
  selectedId,
  onSelect,
  markers = [],
  onMilestone,
}: {
  rows: TimelineRow[];
  start: string;
  end: string;
  mini?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  markers?: { index: number; name: string; date: string; completed: boolean }[];
  onMilestone?: (index: number) => void;
}) {
  const days = dayCount(start, end),
    step = days <= 7 ? 1 : Math.ceil(days / 5),
    current = today();
  const labels = Array.from({ length: Math.ceil(days / step) }, (_, index) =>
    addDays(start, index * step),
  );
  const x = (date: string) => ((dayCount(start, date) - 1) / days) * 100;
  const currentPosition =
    current >= start && current <= end
      ? ((dayCount(start, current) - 0.5) / days) * 100
      : null;
  const visibleMarkers = markers.filter(
    (item) => item.date >= start && item.date <= end,
  );
  return (
    <div
      className={
        "plan-timeline " + (mini ? "plan-mini-timeline" : "plan-main-timeline")
      }
      style={{ "--plan-grid-step": `${(step / days) * 100}%` } as CSSProperties}
      aria-label={mini ? "Cronograma de subtareas" : "Cronograma general"}
    >
      <div className="plan-timeline-heading">
        <span>{mini ? "Subtarea" : "Tarea"}</span>
        <div className="plan-timeline-axis">
          {labels.map((date, index) => (
            <span
              key={date}
              style={{
                left: `${x(date)}%`,
                transform: index === 0 ? "none" : "translateX(-50%)",
              }}
            >
              {days <= 7 ? parseDate(date).getDate() : shortDate(date)}
            </span>
          ))}
        </div>
      </div>
      {rows.map((row) => {
        const placement = timelinePlacement(row, start, end),
          late = row.end < current && row.status !== "completed";
        const label = `${row.title}, ${shortDate(row.start)} a ${shortDate(row.end)}, ${row.progress}% completado, ${planStatusLabels[row.status]}${late ? ", vencida" : ""}`;
        const band = (
          <>
            {placement.visible ? (
              <span
                className={
                  "plan-duration " +
                  (placement.continuesBefore ? "continues-before " : "") +
                  (placement.continuesAfter ? "continues-after " : "") +
                  (row.status === "blocked" ? "blocked" : "")
                }
                style={{
                  left: `${placement.left}%`,
                  width: `${placement.width}%`,
                }}
              >
                <span
                  className="plan-duration-fill"
                  style={{ width: `${placement.fill}%` }}
                />
              </span>
            ) : null}
            {currentPosition !== null ? (
              <i
                className="plan-today-line"
                style={{ left: `${currentPosition}%` }}
              />
            ) : null}
          </>
        );
        return (
          <div
            key={row.id}
            data-row-id={row.id}
            className={
              "plan-timeline-row " + (selectedId === row.id ? "selected" : "")
            }
            style={{ "--plan-accent": planColors[row.color] } as CSSProperties}
          >
            {onSelect ? (
              <button
                type="button"
                className="plan-timeline-name"
                onClick={() => onSelect(row.id)}
                aria-label={label}
              >
                <i className={"plan-status-dot " + row.status} />
                <span>
                  {row.title}
                  {row.inheritedDates ? " *" : ""}
                </span>
              </button>
            ) : (
              <span className="plan-timeline-name">
                <i className={"plan-status-dot " + row.status} />
                <span>
                  {row.title}
                  {row.inheritedDates ? " *" : ""}
                </span>
              </span>
            )}
            {onSelect ? (
              <button
                type="button"
                className="plan-timeline-track"
                onClick={() => onSelect(row.id)}
                aria-label={label}
              >
                {band}
              </button>
            ) : (
              <div
                className="plan-timeline-track"
                role="img"
                aria-label={label}
              >
                {band}
              </div>
            )}
          </div>
        );
      })}
      {visibleMarkers.length ? (
        <div className="plan-timeline-row plan-timeline-milestones">
          <span className="plan-timeline-name">Hitos</span>
          <div className="plan-timeline-track">
            {visibleMarkers.map((item) => (
              <button
                type="button"
                key={item.index}
                className={
                  "plan-timeline-diamond " + (item.completed ? "completed" : "")
                }
                style={{ left: `${x(item.date) + 50 / days}%` }}
                aria-label={`${item.name}, ${shortDate(item.date)}, ${item.completed ? "completado" : "pendiente"}`}
                onClick={() => onMilestone?.(item.index)}
              >
                <i />
              </button>
            ))}
            {currentPosition !== null ? (
              <i
                className="plan-today-line"
                style={{ left: `${currentPosition}%` }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      {mini && rows.some((row) => row.inheritedDates) ? (
        <p className="plan-inherited-note">
          * Sin fechas propias: utiliza el periodo de esta tarea.
        </p>
      ) : null}
      {!rows.length ? (
        <p className="small muted plan-empty-period">
          No hay {mini ? "subtareas" : "tareas"} en este periodo.
        </p>
      ) : null}
      {!mini ? (
        <div className="plan-timeline-legend">
          <span>
            <i />
            Duración
          </span>
          <span>
            <i className="filled" />
            Progreso
          </span>
          <span>
            <i className="today" />
            Hoy
          </span>
        </div>
      ) : null}
    </div>
  );
}
