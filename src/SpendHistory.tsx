import { useState, type FormEvent } from "react";
import type { Entry, Offering } from "../shared/model";
import { money, shortDate, today } from "../shared/domain";
import {
  campaignSpending,
  spendingPeriod,
  type SpendPeriodMode,
} from "../shared/spending";
import { ErrorText, Field } from "./ui";
import { useStore } from "./store";

const modes: { value: SpendPeriodMode; label: string; totalLabel: string }[] = [
  { value: "day", label: "Día", totalLabel: "Gasto del día" },
  { value: "week", label: "Semana", totalLabel: "Gasto de la semana" },
  { value: "month", label: "Mes", totalLabel: "Gasto del mes" },
  { value: "range", label: "Rango", totalLabel: "Gasto del periodo" },
];
const fullDate = (date: string) => date.split("-").reverse().join("/");

export function SpendHistory({
  offering: o,
  entries,
}: {
  offering: Offering;
  entries: Entry[];
}) {
  const { profile, saveOffering } = useStore();
  const current = today(),
    hasStarted = current >= o.start;
  const lastDate = !hasStarted ? o.start : current > o.end ? o.end : current;
  const [mode, setMode] = useState<SpendPeriodMode>("day");
  const [date, setDate] = useState(lastDate);
  const [rangeEnd, setRangeEnd] = useState(lastDate);
  const [editingName, setEditingName] = useState(false);
  const [campaignDraft, setCampaignDraft] = useState(o.campaignName || o.name);
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const period = spendingPeriod(o, mode, date, rangeEnd, current);
  const result = period ? campaignSpending(o, entries, period, current) : null;
  const selection = modes.find((item) => item.value === mode)!;

  async function saveCampaignName(event: FormEvent) {
    event.preventDefault();
    const name = campaignDraft.trim();
    if (!name || name.length > 100) {
      setNameError("Introduce un nombre de campaña de hasta 100 caracteres.");
      return;
    }
    setNameError("");
    setSavingName(true);
    try {
      await saveOffering({ ...o, campaignName: name });
      setEditingName(false);
    } catch (cause) {
      setNameError((cause as Error).message);
    } finally {
      setSavingName(false);
    }
  }

  return (
    <details className="spend-history">
      <summary className="spend-history-summary">
        <span>
          Desglose e historial de gasto<small>{o.campaignName || o.name}</small>
        </span>
      </summary>
      <div className="row spend-campaign-meta">
        <p className="small muted">Inicio de pauta: {fullDate(o.start)}</p>
        {profile?.role === "admin" ? (
          <button
            type="button"
            className="text-button"
            disabled={savingName}
            onClick={() => {
              setCampaignDraft(o.campaignName || o.name);
              setNameError("");
              setEditingName(!editingName);
            }}
          >
            {editingName ? "Cancelar" : "Editar nombre"}
          </button>
        ) : null}
      </div>
      {editingName ? (
        <form className="campaign-name-form" onSubmit={saveCampaignName}>
          <Field label="Nombre de la campaña">
            <input
              required
              maxLength={100}
              value={campaignDraft}
              disabled={savingName}
              onChange={(event) => setCampaignDraft(event.target.value)}
            />
          </Field>
          <ErrorText error={nameError} />
          <button className="secondary full" disabled={savingName}>
            {savingName ? "Guardando..." : "Guardar nombre"}
          </button>
        </form>
      ) : null}
      <div
        className="spend-period-switch"
        role="group"
        aria-label="Periodo del gasto"
      >
        {modes.map((item) => (
          <button
            type="button"
            key={item.value}
            aria-pressed={mode === item.value}
            disabled={!hasStarted}
            onClick={() => setMode(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={mode === "range" ? "columns" : ""}>
        <Field
          label={
            mode === "range"
              ? "Desde"
              : mode === "day"
                ? "Consultar fecha"
                : "Fecha de referencia"
          }
        >
          <input
            type="date"
            min={o.start}
            max={lastDate}
            disabled={!hasStarted}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        {mode === "range" ? (
          <Field label="Hasta">
            <input
              type="date"
              min={date || o.start}
              max={lastDate}
              value={rangeEnd}
              onChange={(event) => setRangeEnd(event.target.value)}
            />
          </Field>
        ) : null}
      </div>
      {!hasStarted ? (
        <p className="small muted">
          La pauta todavía no ha comenzado. No hay gasto registrado hasta hoy.
        </p>
      ) : (
        <ErrorText
          error={
            !period
              ? "Revisa las fechas: deben estar dentro del offering, no ser futuras y el final no puede ser anterior al inicio."
              : ""
          }
        />
      )}
      {period && result ? (
        <>
          <p className="spend-period-dates small muted">
            {period.start === period.end
              ? shortDate(period.start)
              : `${shortDate(period.start)} - ${shortDate(period.end)}`}{" "}
            ·{" "}
            {mode === "week"
              ? "Semana de lunes a domingo"
              : "Periodo consultado"}
          </p>
          <div className="spend-history-total" aria-live="polite">
            <span>{selection.totalLabel}</span>
            <strong>{money(result.total)}</strong>
          </div>
          <dl className="spend-balance-summary" aria-live="polite">
            <div>
              <dt>Gastado antes del periodo</dt>
              <dd>{money(result.previous)}</dd>
            </div>
            <div>
              <dt>Gasto acumulado hasta {fullDate(period.end)}</dt>
              <dd>{money(result.accumulated)}</dd>
            </div>
            <div className={result.remainingAtEnd < 0 ? "orange" : ""}>
              <dt>
                {result.remainingAtEnd < 0
                  ? "Exceso de presupuesto"
                  : "Saldo al final del periodo"}
              </dt>
              <dd>{money(Math.abs(result.remainingAtEnd))}</dd>
            </div>
            <div className={result.remainingToday < 0 ? "orange" : ""}>
              <dt>
                {result.remainingToday < 0
                  ? "Exceso hasta hoy"
                  : "Disponible hoy"}
              </dt>
              <dd>{money(Math.abs(result.remainingToday))}</dd>
            </div>
          </dl>
          <div className="spend-history-platforms">
            {result.platforms.map(
              ({
                platform,
                spent,
                history,
                previous,
                accumulated,
                budget,
                remainingAtEnd,
                remainingToday,
              }) => (
                <details className="spend-platform-detail" key={platform}>
                  <summary>
                    <span>
                      {platform}
                      <small>Presupuesto: {money(budget)}</small>
                    </span>
                    <strong>
                      {money(spent)}
                      <small>En este periodo</small>
                    </strong>
                  </summary>
                  <dl className="spend-platform-balance">
                    <div>
                      <dt>Gastado antes</dt>
                      <dd>{money(previous)}</dd>
                    </div>
                    <div>
                      <dt>Acumulado desde el inicio</dt>
                      <dd>{money(accumulated)}</dd>
                    </div>
                    <div className={remainingAtEnd < 0 ? "orange" : ""}>
                      <dt>
                        {remainingAtEnd < 0
                          ? "Exceso al final del periodo"
                          : "Saldo al final del periodo"}
                      </dt>
                      <dd>{money(Math.abs(remainingAtEnd))}</dd>
                    </div>
                    <div className={remainingToday < 0 ? "orange" : ""}>
                      <dt>
                        {remainingToday < 0
                          ? "Exceso hasta hoy"
                          : "Disponible hoy"}
                      </dt>
                      <dd>{money(Math.abs(remainingToday))}</dd>
                    </div>
                  </dl>
                  <p className="small muted">
                    Historial desde el inicio hasta {shortDate(period.end)}
                  </p>
                  {history.length ? (
                    <div
                      className="spend-platform-days"
                      aria-label={`Detalle de ${platform}`}
                    >
                      {history.map((day) => (
                        <div className="summary-row" key={day.date}>
                          <span>
                            {fullDate(day.date)}
                            {day.date < period.start ? (
                              <small>Anterior al periodo</small>
                            ) : null}
                          </span>
                          <span>{money(day.spent)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="small muted">
                      Sin registros para {platform} hasta esta fecha.
                    </p>
                  )}
                </details>
              ),
            )}
          </div>
        </>
      ) : null}
    </details>
  );
}
