import { useState, type FormEvent } from "react";
import type { Offering, Task } from "../shared/model";
import { milestones } from "../shared/model";
import { validateOffering } from "../shared/domain";
import { milestoneItems } from "../shared/planning";
import { ErrorText, Field } from "./ui";
import { usePlanDialog } from "./PlanningEditor";

export function PlanningSettings({
  offering: o,
  tasks,
  onClose,
  onSave,
}: {
  offering: Offering;
  tasks: Task[];
  onClose: () => void;
  onSave: (offering: Offering) => Promise<void>;
}) {
  const [description, setDescription] = useState(o.planningDescription || "");
  const [drive, setDrive] = useState(o.driveUrl);
  const [dates, setDates] = useState([...o.milestoneDates]);
  const [completed, setCompleted] = useState<(boolean | null)[]>(
    o.milestoneCompleted ? [...o.milestoneCompleted] : [null, null, null, null],
  );
  const [changedCompletion, setChangedCompletion] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ref = usePlanDialog<HTMLDivElement>(() => {
    if (!busy) onClose();
  });
  const words = description.trim().split(/\s+/).filter(Boolean).length;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const next = {
        ...o,
        planningDescription: description.trim(),
        driveUrl: drive.trim(),
        milestoneDates: dates,
        ...(changedCompletion ? { milestoneCompleted: completed } : {}),
      };
      validateOffering(next);
      setBusy(true);
      await onSave(next);
      onClose();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="plan-sheet-backdrop">
      <div
        className="plan-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-settings-title"
        ref={ref}
        tabIndex={-1}
      >
        <div className="plan-sheet-header">
          <h2 id="plan-settings-title">Editar planificación</h2>
          <button
            type="button"
            className="plan-icon-button"
            aria-label="Cerrar ajustes"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <Field
            label="Descripción de la planificación"
            hint={`${words}/140 palabras`}
          >
            <textarea
              rows={4}
              maxLength={3000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={busy}
            />
          </Field>
          {words > 140 ? (
            <ErrorText error="La descripción no puede superar 140 palabras." />
          ) : null}
          <Field label="Carpeta de Drive">
            <input
              type="url"
              value={drive}
              disabled={busy}
              placeholder="https://drive.google.com/drive/folders/..."
              onChange={(event) => setDrive(event.target.value)}
            />
          </Field>
          <h3 className="plan-settings-heading">Hitos</h3>
          <p className="small muted">
            Una fecha pasada no marca el hito como completado.
          </p>
          {milestones.map((name, index) => (
            <div key={name} className="plan-settings-milestone">
              <Field label={`Fecha de ${name}`}>
                <input
                  type="date"
                  required
                  disabled={busy}
                  min={index ? dates[index - 1] : o.start}
                  max={o.end}
                  value={dates[index]}
                  onChange={(event) =>
                    setDates((previous) =>
                      previous.map((date, i) =>
                        i === index ? event.target.value : date,
                      ),
                    )
                  }
                />
              </Field>
              <label className="check">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={
                    completed[index] ??
                    milestoneItems(o, tasks)[index].completed
                  }
                  onChange={(event) => {
                    setChangedCompletion(true);
                    setCompleted((previous) =>
                      previous.map((value, i) =>
                        i === index ? event.target.checked : value,
                      ),
                    );
                  }}
                />
                {name} completado
              </label>
              {completed[index] !== null ? (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setChangedCompletion(true);
                    setCompleted((previous) =>
                      previous.map((value, i) => (i === index ? null : value)),
                    );
                  }}
                >
                  Usar estado de sus tareas
                </button>
              ) : null}
            </div>
          ))}
          <ErrorText error={error} />
          <div className="plan-editor-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="primary" disabled={busy || words > 140}>
              {busy ? "Guardando..." : "Guardar planificación"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
