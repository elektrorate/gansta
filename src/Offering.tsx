import { useState } from "react";
import type { Offering as OfferingModel, Entry } from "../shared/model";
import { platforms } from "../shared/model";
import {
  addDays,
  dayCount,
  isoDate,
  money,
  parseDate,
  shortDate,
  stage,
  today,
  totalBudget,
  totals,
} from "../shared/domain";
import { useStore } from "./store";
import { Back, Header, Progress, go } from "./ui";
import { SpendHistory } from "./SpendHistory";
import { spendingBreakdown } from "../shared/spending";
import { SalesChart } from './SalesChart';

export function Offering({ offering: o }: { offering: OfferingModel }) {
  const { bundle, profile } = useStore(),
    entries = bundle.entries[o.id] || [],
    result = totals(entries, o.start, o.end),
    budget = totalBudget(o),
    spentToDate = spendingBreakdown(entries, o.enabledPlatforms, {
      start: o.start,
      end: today() < o.end ? today() : o.end,
    }).total,
    s = stage(result.closed, o.goal);
  return (
    <>
      <Back />
      <div className="row">
        <Header
          eyebrow="OFFERING"
          title={o.name}
          description={money(o.price) + " · " + o.billing.toLowerCase()}
        />
        {profile?.role === "admin" ? (
          <button className="text-button" onClick={() => go("/edit/" + o.id)}>
            Editar
          </button>
        ) : null}
      </div>
      {o.description || o.externalUrl ? (
        <div className="offering-header-details">
          {o.description ? <p>{o.description}</p> : null}
          {o.externalUrl ? (
            <a href={o.externalUrl} target="_blank" rel="noopener noreferrer">
              Ver detalle del producto ↗
            </a>
          ) : null}
        </div>
      ) : null}
      <section className="surface">
        <div className="row">
          <h2>Cumplimiento de ventas</h2>
          <span className="small muted">
            {shortDate(o.start)} — {shortDate(o.end)}
          </span>
        </div>
        <div className="sales-row">
          <span className="hero-count">
            {result.closed}
            <small> / {o.goal}</small>
          </span>
          <span className="badge">{s.percentage} %</span>
        </div>
        <p className="muted small">{o.unit} {o.unit==='Alumnos'?'conseguidos':'conseguidas'}</p>
        <Progress value={s.percentage} label="Objetivo de ventas" />
        <p className="small muted">
          {result.closed >= o.goal
            ? "Objetivo conseguido"
            : "Faltan " +
              (o.goal - result.closed) +
              " para alcanzar el objetivo"}
        </p>
        <SalesChart offering={o} entries={entries} />
      </section>
      <section className="surface">
        <div className="row">
          <h2>Presupuesto</h2>
          <span className="small muted">Total del offering</span>
        </div>
        <div className="amount">
          {money(spentToDate)} <small>de {money(budget)}</small>
        </div>
        <Progress
          value={budget ? (spentToDate / budget) * 100 : 0}
          color={spentToDate > budget ? "orange" : "green"}
          label="Presupuesto consumido"
        />
        <p className={"small " + (spentToDate > budget ? "orange" : "muted")}>
          {money(Math.abs(budget - spentToDate))}{" "}
          {spentToDate > budget
            ? "por encima del presupuesto"
            : "disponibles hoy"}
        </p>
        <SpendHistory offering={o} entries={entries} />
      </section>
      <button
        type="button"
        className="surface action-row"
        onClick={() => go("/planning/" + o.id)}
      >
        <span>
          <strong>Ver planificación</strong>
          <small>Tareas, hitos y cronogramas de subtareas</small>
        </span>
        <span aria-hidden="true">↗</span>
      </button>
      <Calendar offering={o} entries={entries} />
    </>
  );
}
function Calendar({
  offering: o,
  entries,
}: {
  offering: OfferingModel;
  entries: Entry[];
}) {
  const initial = today() >= o.start && today() <= o.end ? today() : o.start;
  const [selected, setSelected] = useState(initial),
    [reference, setReference] = useState(initial),
    [mode, setMode] = useState<"month" | "week">("month");
  const d = parseDate(reference);
  let start: string, end: string;
  if (mode === "month") {
    start = isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
    end = isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  } else {
    start = addDays(reference, -((d.getDay() + 6) % 7));
    end = addDays(start, 6);
  }
  const days = Array.from({ length: dayCount(start, end) }, (_, i) =>
      addDays(start, i),
    ),
    offset = (parseDate(start).getDay() + 6) % 7,
    summary = totals(entries, start, end),
    daily = entries.filter((e) => e.date === selected),
    sum = totals(daily);
  function move(n: number) {
    const next =
      mode === "month"
        ? isoDate(new Date(d.getFullYear(), d.getMonth() + n, 1))
        : addDays(reference, n * 7);
    setReference(next);
    setSelected(next);
  }
  return (
    <section className="surface calendar">
      <div className="row">
        <h2>Calendario</h2>
        <div className="segmented">
          <button
            aria-pressed={mode === "week"}
            onClick={() => setMode("week")}
          >
            Semana
          </button>
          <button
            aria-pressed={mode === "month"}
            onClick={() => setMode("month")}
          >
            Mes
          </button>
        </div>
      </div>
      <div className="period-results">
        <div>
          <strong>{summary.queries}</strong>
          <span>Consultas</span>
        </div>
        <div>
          <strong>{summary.closed}</strong>
          <span>Cerrados</span>
        </div>
        <div>
          <strong>{money(summary.spent)}</strong>
          <span>Gasto del {mode === "month" ? "mes" : "periodo"}</span>
        </div>
      </div>
      <div className="calendar-heading">
        <button aria-label="Periodo anterior" onClick={() => move(-1)}>
          ‹
        </button>
        <strong>
          {mode === "month"
            ? d.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
            : shortDate(start) + " — " + shortDate(end)}
        </strong>
        <button aria-label="Periodo siguiente" onClick={() => move(1)}>
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {["L", "M", "X", "J", "V", "S", "D"].map((s, i) => (
          <span key={i} className="weekday">
            {s}
          </span>
        ))}
        {mode === "month"
          ? Array.from({ length: offset }, (_, i) => <span key={"empty" + i} />)
          : null}
        {days.map((day) => (
          <button
            key={day}
            aria-label={shortDate(day)}
            aria-pressed={day === selected}
            className={
              (day === selected ? "selected " : "") +
              (entries.some((e) => e.date === day) ? "has-entry" : "")
            }
            onClick={() => setSelected(day)}
          >
            {parseDate(day).getDate()}
          </button>
        ))}
      </div>
      <button
        className="text-button small"
        onClick={() => {
          setReference(today());
          setSelected(today());
        }}
      >
        Hoy
      </button>
      <div className="day-detail">
        <h3>
          {parseDate(selected).toLocaleDateString("es-ES", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </h3>
        {daily.length ? (
          <>
            <div className="period-results">
              <div>
                <strong>{sum.queries}</strong>
                <span>Consultas</span>
              </div>
              <div>
                <strong>{sum.closed}</strong>
                <span>Cerrados</span>
              </div>
              <div>
                <strong>{money(sum.spent)}</strong>
                <span>Gasto</span>
              </div>
            </div>
            {platforms
              .filter((p) => daily.some((e) => e.platform === p))
              .map((p) => (
                <div className="summary-row small" key={p}>
                  <span>{p}</span>
                  <span>
                    {daily.find((e) => e.platform === p)?.closed} cierres ·{" "}
                    {money(daily.find((e) => e.platform === p)?.spent || 0)}
                  </span>
                </div>
              ))}
          </>
        ) : (
          <p className="muted small">
            No hay resultados registrados para este día.
          </p>
        )}
      </div>
    </section>
  );
}
