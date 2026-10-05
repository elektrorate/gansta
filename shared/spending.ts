import type { Entry, Offering, Platform } from "./model.ts";
import {
  addDays,
  isoDate,
  parseDate,
  today,
  validDate,
  totalBudget,
} from "./domain.ts";

export type SpendPeriodMode = "day" | "week" | "month" | "range";
export type SpendPeriod = { start: string; end: string };

export function spendingPeriod(
  offering: Pick<Offering, "start" | "end">,
  mode: SpendPeriodMode,
  date: string,
  rangeEnd: string,
  current = today(),
): SpendPeriod | null {
  const lastDate = offering.end < current ? offering.end : current;
  if (!validDate(date) || date < offering.start || date > lastDate) return null;
  let start = date,
    end = date;
  if (mode === "week") {
    start = addDays(date, -((parseDate(date).getDay() + 6) % 7));
    end = addDays(start, 6);
  } else if (mode === "month") {
    const reference = parseDate(date);
    start = isoDate(new Date(reference.getFullYear(), reference.getMonth(), 1));
    end = isoDate(
      new Date(reference.getFullYear(), reference.getMonth() + 1, 0),
    );
  } else if (mode === "range") {
    if (!validDate(rangeEnd) || rangeEnd < date || rangeEnd > lastDate)
      return null;
    end = rangeEnd;
  }
  return {
    start: start < offering.start ? offering.start : start,
    end: end > lastDate ? lastDate : end,
  };
}

export function spendingBreakdown(
  entries: Entry[],
  platforms: readonly Platform[],
  period: SpendPeriod,
) {
  const records = entries.filter(
    (entry) =>
      entry.date >= period.start &&
      entry.date <= period.end &&
      platforms.includes(entry.platform),
  );
  const dates = [...new Set(records.map((entry) => entry.date))]
    .sort()
    .reverse();
  return {
    total: records.reduce((sum, entry) => sum + entry.spent, 0),
    platforms: platforms.map((platform) => ({
      platform,
      spent: records
        .filter((entry) => entry.platform === platform)
        .reduce((sum, entry) => sum + entry.spent, 0),
      days: dates
        .filter((date) =>
          records.some(
            (entry) => entry.date === date && entry.platform === platform,
          ),
        )
        .map((date) => ({
          date,
          spent: records
            .filter(
              (entry) => entry.date === date && entry.platform === platform,
            )
            .reduce((sum, entry) => sum + entry.spent, 0),
        })),
    })),
  };
}

export function campaignSpending(
  offering: Pick<Offering, "start" | "end" | "enabledPlatforms" | "budgets">,
  entries: Entry[],
  period: SpendPeriod,
  current = today(),
) {
  const selected = spendingBreakdown(
    entries,
    offering.enabledPlatforms,
    period,
  );
  const previous = spendingBreakdown(entries, offering.enabledPlatforms, {
    start: offering.start,
    end: addDays(period.start, -1),
  });
  const accumulated = spendingBreakdown(entries, offering.enabledPlatforms, {
    start: offering.start,
    end: period.end,
  });
  const latest = spendingBreakdown(entries, offering.enabledPlatforms, {
    start: offering.start,
    end: current < offering.end ? current : offering.end,
  });
  const budget = totalBudget(offering);
  return {
    total: selected.total,
    previous: previous.total,
    accumulated: accumulated.total,
    remainingAtEnd: budget - accumulated.total,
    spentToDate: latest.total,
    remainingToday: budget - latest.total,
    platforms: selected.platforms.map((item, index) => ({
      ...item,
      budget: offering.budgets[item.platform],
      previous: previous.platforms[index].spent,
      accumulated: accumulated.platforms[index].spent,
      remainingAtEnd:
        offering.budgets[item.platform] - accumulated.platforms[index].spent,
      remainingToday:
        offering.budgets[item.platform] - latest.platforms[index].spent,
      history: accumulated.platforms[index].days,
    })),
  };
}
