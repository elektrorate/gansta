import { useState, type FormEvent } from "react";
import { categories, platforms, type Offering } from "../shared/model";
import {
  addDays,
  dayCount,
  money,
  totalBudget,
  validateOffering,
  weeklyTargets,
} from "../shared/domain";
import { newOffering } from "./data";
import { useStore } from "./store";
import { Back, ErrorText, Field, Header, go } from "./ui";
import { nextSalesTarget } from '../shared/sales';
export function OfferingForm({ existing }: { existing?: Offering }) {
  const { profile, bundle, saveOffering } = useStore();
  const [o, setO] = useState(() =>
      existing ? structuredClone(existing) : newOffering(profile!.id),
    ),
    [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const people = bundle.profiles.filter((p) => p.status === "active");
  const nextTarget = nextSalesTarget(o);
  function patch(values: Partial<Offering>) {
    setO((prev) => ({ ...prev, ...values }));
  }
  function schedule(start: string, end: string, goal: number) {
    const days = dayCount(start, end);
    patch({
      start,
      end,
      goal,
      targets: weeklyTargets(start, end, goal),
      milestoneDates:
        Number.isFinite(days) && days > 0
          ? [
              start,
              addDays(start, Math.round((days - 1) * 0.2)),
              addDays(start, Math.round((days - 1) * 0.45)),
              end,
            ]
          : o.milestoneDates,
    });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const next = {
      ...o,
      name: o.name.trim(),
      campaignName: (o.campaignName || "").trim(),
      memberIds: [...new Set([o.ownerId, ...o.memberIds])],
      driveUrl: o.driveUrl.trim(),
    };
    try {
      validateOffering(next);
      if (step < 2) {
        setStep(step + 1);
        window.scrollTo(0, 0);
        return;
      }
      setBusy(true);
      await saveOffering(next);
      go("/offering/" + o.id);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Back
        to={existing ? "/offering/" + existing.id : "/admin"}
        label={existing ? "Offering" : "Administración"}
      />
      <Header
        eyebrow="ADMINISTRACIÓN"
        title={existing ? "Editar offering" : "Crear offering"}
        description="Un producto. Un objetivo. Un plan."
      />
      <div className="steps">
        {["Producto", "Objetivo", "Equipo"].map((s, i) => (
          <div
            key={s}
            className={i <= step ? "active" : ""}
            aria-current={step === i ? "step" : undefined}
          >
            {i + 1}. {s}
          </div>
        ))}
      </div>
      <form onSubmit={submit}>
        {step === 0 ? (
          <>
            <Field label="Nombre del producto">
              <input
                required
                maxLength={100}
                value={o.name}
                placeholder="Clases regulares"
                onChange={(e) => patch({ name: e.target.value })}
              />
            </Field>
            <Field label="Categoría">
              <select
                value={o.category}
                onChange={(e) =>
                  patch({ category: e.target.value as Offering["category"] })
                }
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <div className="columns">
              <Field label="Precio (€)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  inputMode="decimal"
                  value={o.price / 100}
                  onChange={(e) =>
                    patch({ price: Math.round(Number(e.target.value) * 100) })
                  }
                />
              </Field>
              <Field label="Tipo de cobro">
                <select
                  value={o.billing}
                  onChange={(e) =>
                    patch({ billing: e.target.value as Offering["billing"] })
                  }
                >
                  <option>Por inscripción</option>
                  <option>Mensual</option>
                  <option>Por unidad</option>
                </select>
              </Field>
            </div>
            <Field label="Descripción · opcional">
              <textarea
                value={o.description}
                maxLength={2000}
                rows={3}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </Field>
            <Field label="Enlace externo · opcional">
              <input
                type="url"
                value={o.externalUrl || ""}
                placeholder="https://ejemplo.com/producto"
                onChange={(e) => patch({ externalUrl: e.target.value })}
              />
            </Field>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <Field label="Nombre de la campaña">
              <input
                maxLength={100}
                value={o.campaignName || ""}
                placeholder={o.name || "Pauta de octubre"}
                onChange={(event) =>
                  patch({ campaignName: event.target.value })
                }
              />
            </Field>
            <div className="columns">
              <Field label="Fecha de inicio">
                <input
                  type="date"
                  required
                  value={o.start}
                  onChange={(e) => schedule(e.target.value, o.end, o.goal)}
                />
              </Field>
              <Field label="Fecha de fin">
                <input
                  type="date"
                  min={o.start}
                  required
                  value={o.end}
                  onChange={(e) => schedule(o.start, e.target.value, o.goal)}
                />
              </Field>
            </div>
            <Field label="Tipo de objetivo">
              <select
                value={o.unit}
                onChange={(e) => patch({ unit: e.target.value })}
              >
                <option>Inscripciones</option>
                <option>Alumnos</option>
                <option>Reservas</option>
                <option>Unidades vendidas</option>
              </select>
            </Field>
            <Field label="Cantidad objetivo">
              <input
                type="number"
                required
                min="1"
                step="1"
                inputMode="numeric"
                value={o.goal}
                onChange={(e) =>
                  schedule(o.start, o.end, Number(e.target.value))
                }
              />
            </Field>
            <details className="surface budget-editor" open>
              <summary>
                <strong>Presupuesto por plataforma</strong>
                <span>Total: {money(totalBudget(o))}</span>
              </summary>
              <p className="small muted">
                Asigna el presupuesto para todo el periodo.
              </p>
              {platforms.map((p) => (
                <div key={p} className="platform-editor">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={o.enabledPlatforms.includes(p)}
                      onChange={(e) =>
                        patch({
                          enabledPlatforms: e.target.checked
                            ? [...o.enabledPlatforms, p]
                            : o.enabledPlatforms.filter((v) => v !== p),
                        })
                      }
                    />
                    {p} Ads
                  </label>
                  {o.enabledPlatforms.includes(p) ? (
                    <Field label={"Importe para " + p + " (€)"}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        inputMode="decimal"
                        value={o.budgets[p] / 100}
                        onChange={(e) =>
                          patch({
                            budgets: {
                              ...o.budgets,
                              [p]: Math.round(Number(e.target.value) * 100),
                            },
                          })
                        }
                      />
                    </Field>
                  ) : null}
                </div>
              ))}
            </details>
            <section className="surface">
              <h2>Hitos y objetivos de ventas</h2>
              <p className="small muted">
                Define las fechas y cantidades acumuladas y marca los puntos que se verán arriba del gráfico. Son objetivos de ventas, no hitos de tareas. Se recalculan al cambiar el periodo o el objetivo total.
              </p>
              {o.targets.map((t, i) => (
                <div key={i} className="sales-target-editor">
                  <div className="row"><h3>{i===o.targets.length-1?'Objetivo final':`Meta ${i+1}`}</h3>{i<o.targets.length-1?<button type="button" className="text-button" aria-label={`Eliminar meta ${i+1}`} onClick={()=>patch({targets:o.targets.filter((_,index)=>index!==i)})}>Eliminar</button>:null}</div>
                  <div className="columns">
                  <Field label={`Fecha de la meta ${i+1}`}><input type="date" required min={i?addDays(o.targets[i-1].date,1):o.start} max={i<o.targets.length-1?addDays(o.targets[i+1].date,-1):o.end} readOnly={i===o.targets.length-1} value={t.date} onChange={event=>patch({targets:o.targets.map((value,index)=>index===i?{...value,date:event.target.value}:value)})}/></Field>
                  <Field label={`Objetivo acumulado ${i+1}`}>
                  <input
                    aria-label={`Objetivo acumulado ${i+1}`}
                    type="number"
                    required
                    min={i ? o.targets[i - 1].count : 0}
                    max={i<o.targets.length-1?o.targets[i+1].count:o.goal}
                    step="1"
                    value={t.count}
                    readOnly={i===o.targets.length-1}
                    onChange={(e) =>
                      patch({
                        targets: o.targets.map((v, j) =>
                          j === i ? { ...v, count: Number(e.target.value) } : v,
                        ),
                      })
                    }
                  />
                  </Field></div>
                  <label className="check"><input type="checkbox" checked={t.showMilestone??(o.targets.length===1||i<o.targets.length-1)} onChange={event=>patch({targets:o.targets.map((value,index)=>index===i?{...value,showMilestone:event.target.checked}:value)})}/>Mostrar como hito en el gráfico</label>
                  {i===o.targets.length-1?<p className="small muted">La fecha final y la cantidad corresponden al objetivo total del offering.</p>:null}
                </div>
              ))}
              <button type="button" className="secondary full" disabled={!nextTarget} onClick={()=>{if(nextTarget)patch({targets:[...o.targets,nextTarget].sort((a,b)=>a.date.localeCompare(b.date))})}}>+ Añadir hito de ventas</button>
            </section>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <Field label="Responsable del offering">
              <select
                value={o.ownerId}
                required
                onChange={(e) =>
                  patch({
                    ownerId: e.target.value,
                    memberIds: [...new Set([...o.memberIds, e.target.value])],
                  })
                }
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <section className="surface">
              <h2>Colaboradores</h2>
              {people
                .filter((p) => p.id !== o.ownerId)
                .map((p) => (
                  <label className="check" key={p.id}>
                    <input
                      type="checkbox"
                      checked={o.memberIds.includes(p.id)}
                      onChange={(e) =>
                        patch({
                          memberIds: e.target.checked
                            ? [...o.memberIds, p.id]
                            : o.memberIds.filter((v) => v !== p.id),
                        })
                      }
                    />
                    {p.name}
                  </label>
                ))}
            </section>
            <Field label="Carpeta de Drive · opcional">
              <input
                type="url"
                value={o.driveUrl}
                placeholder="https://drive.google.com/drive/folders/…"
                onChange={(e) => patch({ driveUrl: e.target.value })}
              />
            </Field>
          </>
        ) : null}
        <ErrorText error={error} />
        <button className="primary" disabled={busy}>
          {busy
            ? "Guardando…"
            : step < 2
              ? "Continuar →"
              : existing
                ? "Guardar cambios"
                : "Crear offering"}
        </button>
        {step > 0 ? (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => {
              setStep(step - 1);
              setError("");
            }}
          >
            ← Volver al paso anterior
          </button>
        ) : null}
      </form>
    </>
  );
}
