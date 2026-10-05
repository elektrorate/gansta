import { addDays, dayCount } from "./domain.ts";
import type { Offering, Target } from "./model.ts";

export function forecastPoints(
  o: Pick<Offering, "start" | "targets">,
): Target[] {
  const points = new Map<string, Target>([
    [o.start, { date: o.start, count: 0 }],
  ]);
  for (const target of o.targets) points.set(target.date, target);
  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function expectedSalesAt(
  o: Pick<Offering, "start" | "end" | "targets">,
  date: string,
): number {
  const day = date < o.start ? o.start : date > o.end ? o.end : date;
  const points = forecastPoints(o).filter(
    (point) => point.date >= o.start && point.date <= o.end,
  );
  let previous = points[0];
  for (const point of points) {
    if (point.date === day) return point.count;
    if (point.date > day) {
      const elapsed = dayCount(previous.date, day) - 1;
      const span = dayCount(previous.date, point.date) - 1;
      return previous.count + ((point.count - previous.count) * elapsed) / span;
    }
    previous = point;
  }
  return previous.count;
}

export function salesMilestones(o: Pick<Offering, "targets">): Target[] {
  const targets = [...o.targets].sort((a, b) => a.date.localeCompare(b.date));
  return targets.filter(
    (target, index) =>
      target.showMilestone ?? (targets.length === 1 || index < targets.length - 1),
  );
}

export function nextSalesTarget(
  o: Pick<Offering, "start" | "end" | "targets" | "goal">,
): Target | null {
  if (o.targets.length >= 524 || o.start >= o.end) return null;
  const dates = [
    addDays(o.start, -1),
    ...new Set([
      ...o.targets
        .filter((target) => target.date >= o.start && target.date <= o.end)
        .map((target) => target.date),
      o.end,
    ]),
  ].sort();
  let largestGap = 1;
  let date: string | null = null;
  for (let index = 1; index < dates.length; index++) {
    const gap = dayCount(dates[index - 1], dates[index]) - 1;
    if (gap > largestGap) {
      largestGap = gap;
      date = addDays(dates[index - 1], Math.floor(gap / 2));
    }
  }
  if (date === null) return null;
  return {
    date,
    count: Math.min(o.goal, Math.round(expectedSalesAt(o, date))),
    showMilestone: true,
  };
}

export function salesMilestoneLabel(count: number, unit: string): string {
  const abbreviations: Record<string, string> = {
    Alumnos: "al.",
    Inscripciones: "insc.",
    Reservas: "res.",
    "Unidades vendidas": "ud.",
  };
  const abbreviation = Object.hasOwn(abbreviations, unit)
    ? abbreviations[unit]
    : `${unit.trim().split(/\s+/)[0].slice(0, 4).toLowerCase()}.`;
  return `${String(count).padStart(2, "0")} ${abbreviation}`;
}

export function layoutSalesMilestones(
  o: Pick<Offering, "start" | "end" | "targets" | "unit">,
  selectedDay?: string,
): {
  markers: Array<{
    target: Target;
    index: number;
    x: number;
    label: string;
    labelX: number;
    labelRow: number | null;
    hitWidth: number;
  }>;
  labelRows: number;
} {
  const days = dayCount(o.start, o.end) - 1 || 1;
  const markers = salesMilestones(o).map((target) => {
    const x = 30 + ((dayCount(o.start, target.date) - 1) / days) * 270;
    const label = salesMilestoneLabel(target.count, o.unit);
    const width = label.length * 8 + 8;
    return {
      target,
      index: o.targets.indexOf(target),
      x,
      label,
      labelX: Math.max(4 + width / 2, Math.min(322 - width / 2, x)),
      labelRow: null as number | null,
      hitWidth: 0,
    };
  });
  const labelled =
    markers.length <= 6
      ? markers.map((_, index) => index)
      : Array.from({ length: 6 }, (_, index) =>
          Math.round((index * (markers.length - 1)) / 5),
        );
  const selected = markers.findIndex((marker) => marker.target.date === selectedDay);
  if (markers.length > 6 && selected >= 0 && !labelled.includes(selected)) {
    let closest = 1;
    for (let index = 2; index < labelled.length - 1; index++) {
      if (
        Math.abs(labelled[index] - selected) <
        Math.abs(labelled[closest] - selected)
      )
        closest = index;
    }
    labelled[closest] = selected;
    labelled.sort((a, b) => a - b);
  }
  const rows: Array<Array<{ left: number; right: number }>> = [];
  for (const index of labelled) {
    const marker = markers[index];
    const halfWidth = (marker.label.length * 8 + 8) / 2;
    const interval = {
      left: marker.labelX - halfWidth,
      right: marker.labelX + halfWidth,
    };
    let row = rows.findIndex((intervals) =>
      intervals.every(
        (other) =>
          interval.left >= other.right + 4 ||
          interval.right + 4 <= other.left,
      ),
    );
    if (row < 0) {
      row = rows.length;
      rows.push([]);
    }
    rows[row].push(interval);
    marker.labelRow = row;
  }
  for (let index = 0; index < markers.length; index++) {
    const marker = markers[index];
    const before = markers[index - 1]?.x ?? marker.x - 50;
    const after = markers[index + 1]?.x ?? marker.x + 50;
    // A centered button must fit the nearest gap on both sides.
    marker.hitWidth = (Math.min(marker.x - before, after - marker.x) / 326) * 100;
  }
  return { markers, labelRows: Math.max(1, rows.length) };
}
