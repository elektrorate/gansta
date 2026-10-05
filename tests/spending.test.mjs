import test from "node:test";
import assert from "node:assert/strict";
import {
  spendingBreakdown,
  spendingPeriod,
  campaignSpending,
} from "../shared/spending.ts";

const offering = { start: "2026-10-01", end: "2026-10-31" };
const records = [
  { date: "2026-09-30", platform: "Meta", spent: 9999 },
  { date: "2026-10-01", platform: "Meta", spent: 3000 },
  { date: "2026-10-02", platform: "Meta", spent: 3000 },
  { date: "2026-10-02", platform: "Google", spent: 1000 },
  { date: "2026-10-03", platform: "TikTok", spent: 500 },
  { date: "2026-10-05", platform: "Meta", spent: 8000 },
];
const platforms = ["Meta", "Google", "TikTok"];
const campaign = {
  ...offering,
  enabledPlatforms: platforms,
  budgets: { Meta: 15000, Google: 10000, TikTok: 5000 },
};

test("Campaña: gasto previo, acumulado, saldo histórico y saldo actual diferenciados", () => {
  const result = campaignSpending(
    campaign,
    records,
    { start: "2026-10-02", end: "2026-10-02" },
    "2026-10-04",
  );
  assert.equal(result.total, 4000);
  assert.equal(result.previous, 3000);
  assert.equal(result.accumulated, 7000);
  assert.equal(result.remainingAtEnd, 23000);
  assert.equal(result.spentToDate, 7500);
  assert.equal(result.remainingToday, 22500);
  assert.equal(result.platforms[0].previous, 3000);
  assert.equal(result.platforms[0].accumulated, 6000);
  assert.equal(result.platforms[0].remainingAtEnd, 9000);
  assert.equal(result.platforms[2].remainingAtEnd, 5000);
  assert.equal(result.platforms[2].remainingToday, 4500);
  assert.deepEqual(result.platforms[0].history, [
    { date: "2026-10-02", spent: 3000 },
    { date: "2026-10-01", spent: 3000 },
  ]);
});

test("Campaña: presupuesto excedido conserva el exceso y primer día no incluye gasto anterior", () => {
  const result = campaignSpending(
    { ...campaign, budgets: { Meta: 1000, Google: 1000, TikTok: 1000 } },
    records,
    { start: "2026-10-01", end: "2026-10-01" },
    "2026-10-04",
  );
  assert.equal(result.previous, 0);
  assert.equal(result.remainingAtEnd, 0);
  assert.equal(result.remainingToday, -4500);
  assert.equal(result.platforms[0].remainingAtEnd, -2000);
  assert.equal(result.platforms[0].remainingToday, -5000);
  const future = campaignSpending(
    campaign,
    records,
    { start: "2026-10-01", end: "2026-10-01" },
    "2026-09-30",
  );
  assert.equal(future.spentToDate, 0);
  assert.equal(future.remainingToday, 30000);
});

test("Gasto: selector diario y semana inclusiva limitados al offering y hoy", () => {
  assert.deepEqual(
    spendingPeriod(offering, "day", "2026-10-02", "", "2026-10-04"),
    { start: "2026-10-02", end: "2026-10-02" },
  );
  assert.deepEqual(
    spendingPeriod(offering, "week", "2026-10-02", "", "2026-10-04"),
    { start: "2026-10-01", end: "2026-10-04" },
  );
  assert.deepEqual(
    spendingPeriod(offering, "week", "2026-10-07", "", "2026-10-31"),
    { start: "2026-10-05", end: "2026-10-11" },
  );
});

test("Gasto: meses completos, bisiestos y truncados al periodo disponible", () => {
  assert.deepEqual(
    spendingPeriod(offering, "month", "2026-10-02", "", "2026-10-04"),
    { start: "2026-10-01", end: "2026-10-04" },
  );
  assert.deepEqual(
    spendingPeriod(
      { start: "2024-02-01", end: "2024-03-31" },
      "month",
      "2024-02-10",
      "",
      "2024-03-31",
    ),
    { start: "2024-02-01", end: "2024-02-29" },
  );
  assert.deepEqual(
    spendingPeriod(
      { start: "2026-10-05", end: "2026-10-15" },
      "month",
      "2026-10-10",
      "",
      "2026-10-31",
    ),
    { start: "2026-10-05", end: "2026-10-15" },
  );
});

test("Gasto: rangos inválidos y futuros no muestran resultados", () => {
  assert.equal(
    spendingPeriod(offering, "range", "2026-10-03", "2026-10-02", "2026-10-04"),
    null,
  );
  assert.equal(
    spendingPeriod(offering, "day", "2026-10-05", "", "2026-10-04"),
    null,
  );
  assert.equal(
    spendingPeriod(offering, "range", "2026-10-01", "2026-10-06", "2026-10-04"),
    null,
  );
  assert.equal(spendingPeriod(offering, "day", "", "", "2026-10-04"), null);
  assert.equal(
    spendingPeriod(offering, "day", "2026-10-01", "", "2026-09-30"),
    null,
  );
  assert.equal(
    spendingPeriod(offering, "day", "2026-09-30", "", "2026-10-04"),
    null,
  );
});

test("Gasto: desglose por plataforma y fecha sin incluir registros externos o futuros", () => {
  const period = spendingPeriod(
    offering,
    "month",
    "2026-10-02",
    "",
    "2026-10-04",
  );
  const result = spendingBreakdown(records, platforms, period);
  assert.equal(result.total, 7500);
  assert.deepEqual(
    result.platforms.map((item) => item.spent),
    [6000, 1000, 500],
  );
  assert.deepEqual(result.platforms[0].days, [
    { date: "2026-10-02", spent: 3000 },
    { date: "2026-10-01", spent: 3000 },
  ]);
  assert.equal(
    spendingBreakdown(records, platforms, {
      start: "2026-10-02",
      end: "2026-10-02",
    }).total,
    4000,
  );
  assert.equal(spendingBreakdown(records, ["Google"], period).total, 1000);
  assert.equal(spendingBreakdown([], platforms, period).total, 0);
});
