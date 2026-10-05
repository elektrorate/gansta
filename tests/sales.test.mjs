import test from "node:test";
import assert from "node:assert/strict";
import { addDays, dayCount, validateOffering } from "../shared/domain.ts";
import {
  forecastPoints,
  expectedSalesAt,
  salesMilestones,
  nextSalesTarget,
  salesMilestoneLabel,
  layoutSalesMilestones,
} from "../shared/sales.ts";

const offering = (overrides = {}) => ({
  id: "sales",
  name: "Classes",
  category: "Cursos",
  price: 1000,
  billing: "Por unidad",
  description: "",
  start: "2026-10-01",
  end: "2026-10-11",
  goal: 30,
  unit: "Alumnos",
  budgets: { Meta: 0, Google: 0, TikTok: 0 },
  enabledPlatforms: [],
  targets: [
    { date: "2026-10-05", count: 10 },
    { date: "2026-10-09", count: 22 },
    { date: "2026-10-11", count: 30 },
  ],
  ownerId: "owner",
  memberIds: ["owner"],
  milestoneDates: ["2026-10-01", "2026-10-05", "2026-10-09", "2026-10-11"],
  driveUrl: "",
  createdAt: "2026-10-01",
  ...overrides,
});

test("Forecast points are sorted, unique, and retain the last target on a date", () => {
  const o = offering({
    targets: [
      { date: "2026-10-11", count: 30 },
      { date: "2026-10-05", count: 8 },
      { date: "2026-10-01", count: 3 },
      { date: "2026-10-05", count: 10, showMilestone: false },
    ],
  });
  const before = structuredClone(o);
  assert.deepEqual(forecastPoints(o), [
    { date: "2026-10-01", count: 3 },
    { date: "2026-10-05", count: 10, showMilestone: false },
    { date: "2026-10-11", count: 30 },
  ]);
  assert.deepEqual(o, before);
  assert.deepEqual(forecastPoints({ start: o.start, targets: [] }), [
    { date: o.start, count: 0 },
  ]);
});

test("Expected sales interpolate cumulative counts and preserve exact integer checkpoints", () => {
  const o = offering();
  assert.equal(expectedSalesAt(o, o.start), 0);
  assert.equal(expectedSalesAt(o, "2026-10-02"), 2.5);
  assert.equal(expectedSalesAt(o, "2026-10-03"), 5);
  assert.equal(expectedSalesAt(o, "2026-10-07"), 16);
  assert.equal(expectedSalesAt(o, "2026-10-10"), 26);
  for (const target of o.targets) {
    assert.equal(expectedSalesAt(o, target.date), target.count);
    assert(Number.isInteger(expectedSalesAt(o, target.date)));
  }
  let previous = 0;
  for (let offset = 0; offset < dayCount(o.start, o.end); offset++) {
    const value = expectedSalesAt(o, addDays(o.start, offset));
    assert(value >= previous && value <= o.goal);
    previous = value;
  }
});

test("Expected sales clamp to the period and ignore checkpoints outside it", () => {
  const o = offering({
    targets: [
      { date: "2026-09-30", count: 999 },
      ...offering().targets,
      { date: "2026-10-12", count: 999 },
    ],
  });
  assert.equal(expectedSalesAt(o, "2026-09-01"), 0);
  assert.equal(expectedSalesAt(o, "2026-10-03"), 5);
  assert.equal(expectedSalesAt(o, "2026-11-01"), 30);
  const atStart = offering({
    targets: [{ date: o.start, count: 4 }, ...offering().targets],
  });
  assert.equal(expectedSalesAt(atStart, atStart.start), 4);
  assert.equal(expectedSalesAt(atStart, "2026-09-30"), 4);
  assert.equal(expectedSalesAt(atStart, "2026-10-03"), 7);
});

test("Forecasts support flat accumulated counts, empty targets, and no extrapolation", () => {
  const o = offering({
    targets: [
      { date: "2026-10-05", count: 10 },
      { date: "2026-10-09", count: 10 },
    ],
  });
  assert.equal(expectedSalesAt(o, "2026-10-07"), 10);
  assert.equal(expectedSalesAt(o, o.end), 10);
  assert.equal(expectedSalesAt(offering({ targets: [] }), o.end), 0);
});

test("ISO date interpolation handles leap days and year boundaries", () => {
  const leap = offering({
    start: "2024-02-28",
    end: "2024-03-01",
    targets: [{ date: "2024-03-01", count: 10 }],
  });
  assert.equal(expectedSalesAt(leap, "2024-02-29"), 5);
  assert.deepEqual(nextSalesTarget(leap), {
    date: "2024-02-28", count: 0, showMilestone: true,
  });
  const year = offering({
    start: "2025-12-31",
    end: "2026-01-02",
    targets: [{ date: "2026-01-02", count: 10 }],
  });
  assert.equal(expectedSalesAt(year, "2026-01-01"), 5);
});

test("Milestones default to intermediate targets, except a single final target", () => {
  const o = offering();
  assert.deepEqual(salesMilestones(o), o.targets.slice(0, -1));
  assert.deepEqual(salesMilestones({ targets: [o.targets.at(-1)] }), [o.targets.at(-1)]);
  assert.deepEqual(salesMilestones({ targets: [] }), []);
  assert.deepEqual(salesMilestones({ targets: [...o.targets].reverse() }), o.targets.slice(0, -1));
});

test("Explicit milestone toggles override intermediate, final, and single defaults", () => {
  const o = offering({
    targets: offering().targets.map((target, index) => ({
      ...target,
      showMilestone: index === 2,
    })),
  });
  assert.deepEqual(salesMilestones(o), [o.targets[2]]);
  assert.deepEqual(salesMilestones({ targets: [{ ...o.targets[2], showMilestone: false }] }), []);
  assert.deepEqual(salesMilestones({ targets: [{ ...o.targets[0], showMilestone: true }] }), [
    { ...o.targets[0], showMilestone: true },
  ]);
});

test("Next target chooses the midpoint of the largest gap and rounds the forecast", () => {
  const o = offering();
  const before = structuredClone(o);
  const target = nextSalesTarget(o);
  assert.deepEqual(target, { date: "2026-10-02", count: 3, showMilestone: true });
  const inserted = { ...o, targets: [...o.targets, target].sort((a, b) => a.date.localeCompare(b.date)) };
  assert.equal(validateOffering(inserted), inserted);
  assert.deepEqual(o, before);
  const later = offering({
    targets: [
      { date: "2026-10-02", count: 2 },
      { date: "2026-10-11", count: 30 },
    ],
  });
  assert.deepEqual(nextSalesTarget(later), {
    date: "2026-10-06", count: 14, showMilestone: true,
  });
});

test("Repeated insertion keeps dates unique, in period, and counts sorted and cumulative", () => {
  const o = offering();
  let inserted = 0;
  for (let target; (target = nextSalesTarget(o)); ) {
    assert(target.date >= o.start && target.date < o.end);
    assert(!o.targets.some((point) => point.date === target.date));
    assert.equal(target.count, Math.min(o.goal, Math.round(expectedSalesAt(o, target.date))));
    assert.equal(target.showMilestone, true);
    o.targets = [...o.targets, target].sort((a, b) => a.date.localeCompare(b.date));
    assert.doesNotThrow(() => validateOffering(o));
    inserted++;
    assert(inserted <= dayCount(o.start, o.end));
  }
  assert.equal(o.targets.length, dayCount(o.start, o.end));
  assert.equal(nextSalesTarget(o), null);
});

test("Next target can use start, resolves equal gaps earliest, and never exceeds goal", () => {
  const o = offering({
    end: "2026-10-03",
    targets: [
      { date: "2026-10-02", count: 10 },
      { date: "2026-10-03", count: 30 },
    ],
  });
  assert.deepEqual(nextSalesTarget(o), { date: o.start, count: 0, showMilestone: true });
  const tied = offering({
    end: "2026-10-08",
    targets: [
      { date: "2026-10-04", count: 10 },
      { date: "2026-10-08", count: 30 },
    ],
  });
  assert.equal(nextSalesTarget(tied).date, "2026-10-02");
  const overGoal = offering({ goal: 2 });
  assert.equal(nextSalesTarget(overGoal).count, 2);
  const missingFinal = offering({ targets: [] });
  assert.equal(nextSalesTarget(missingFinal).date, "2026-10-05");
});

test("Next target respects the 524 target limit", () => {
  const start = "2025-01-01";
  const o = offering({
    start,
    end: addDays(start, 1046),
    goal: 1046,
    targets: Array.from({ length: 523 }, (_, index) => ({
      date: addDays(start, (index + 1) * 2),
      count: (index + 1) * 2,
    })),
  });
  assert.notEqual(nextSalesTarget(o), null);
  o.targets.push({ date: start, count: 0 });
  assert.equal(nextSalesTarget(o), null);
  o.targets.push({ date: addDays(start, 1), count: 1 });
  assert.equal(nextSalesTarget(o), null);
});

test("Single-day periods preserve the start checkpoint and have no insertion space", () => {
  const o = offering({
    end: "2026-10-01",
    targets: [{ date: "2026-10-01", count: 30 }],
  });
  assert.deepEqual(forecastPoints(o), o.targets);
  assert.equal(expectedSalesAt(o, o.start), 30);
  assert.equal(expectedSalesAt(o, "2026-09-30"), 30);
  assert.equal(expectedSalesAt(o, "2026-10-02"), 30);
  assert.equal(nextSalesTarget(o), null);
  assert.equal(nextSalesTarget({ ...o, targets: [] }), null);
  const { markers, labelRows } = layoutSalesMilestones(o);
  assert.equal(markers[0].x, 30);
  assert.equal(markers[0].labelRow, 0);
  assert.equal(markers[0].hitWidth, (50 / 326) * 100);
  assert.equal(labelRows, 1);
});

test("Milestone labels pad counts and abbreviate known and custom units", () => {
  assert.equal(salesMilestoneLabel(0, "Alumnos"), "00 al.");
  assert.equal(salesMilestoneLabel(7, "Inscripciones"), "07 insc.");
  assert.equal(salesMilestoneLabel(12, "Reservas"), "12 res.");
  assert.equal(salesMilestoneLabel(100, "Unidades vendidas"), "100 ud.");
  assert.equal(salesMilestoneLabel(3, "Participantes activos"), "03 part.");
  assert.equal(salesMilestoneLabel(8, "  Packs grandes  "), "08 pack.");
  assert.equal(salesMilestoneLabel(1, "Kg"), "01 kg.");
  assert.equal(salesMilestoneLabel(2, "constructor"), "02 cons.");
});

function assertLabelLayout(layout) {
  assert(layout.labelRows >= 1);
  for (const marker of layout.markers) {
    if (marker.labelRow === null) continue;
    const halfWidth = (marker.label.length * 8 + 8) / 2;
    assert(marker.labelX - halfWidth >= 4);
    assert(marker.labelX + halfWidth <= 322);
    assert(marker.labelRow >= 0 && marker.labelRow < layout.labelRows);
  }
  for (let row = 0; row < layout.labelRows; row++) {
    const intervals = layout.markers
      .filter((marker) => marker.labelRow === row)
      .map((marker) => ({
        left: marker.labelX - (marker.label.length * 8 + 8) / 2,
        right: marker.labelX + (marker.label.length * 8 + 8) / 2,
      }))
      .sort((a, b) => a.left - b.left);
    for (let index = 1; index < intervals.length; index++) {
      assert(intervals[index].left >= intervals[index - 1].right + 4);
    }
  }
}

test("Layout positions start/end checkpoints exactly and retains original indices", () => {
  const o = offering({
    targets: [
      { date: "2026-10-11", count: 30, showMilestone: true },
      { date: "2026-10-01", count: 0 },
      { date: "2026-10-05", count: 10, showMilestone: false },
      { date: "2026-10-06", count: 15 },
    ],
  });
  const layout = layoutSalesMilestones(o);
  assert.deepEqual(layout.markers.map((marker) => marker.index), [1, 3, 0]);
  assert.deepEqual(layout.markers.map((marker) => marker.x), [30, 165, 300]);
  assert(layout.markers.every((marker) => marker.labelRow !== null));
  assertLabelLayout(layout);
  assert.equal(layout.markers[0].hitWidth, (50 / 326) * 100);
  assert.equal(layout.markers[1].hitWidth, (135 / 326) * 100);
  assert.equal(layout.markers[2].hitWidth, (50 / 326) * 100);
  assert.deepEqual(layoutSalesMilestones({ ...o, targets: [] }), { markers: [], labelRows: 1 });
});

test("Crowded labels use separate lanes, stay in bounds, and size hit areas by nearest gap", () => {
  const o = offering({
    start: "2026-01-01",
    end: "2026-12-31",
    unit: "Inscripciones",
    targets: [
      { date: "2026-01-01", count: 0, showMilestone: true },
      { date: "2026-01-02", count: 1, showMilestone: true },
      { date: "2026-01-03", count: 2, showMilestone: true },
      { date: "2026-12-29", count: 28, showMilestone: true },
      { date: "2026-12-30", count: 29, showMilestone: true },
      { date: "2026-12-31", count: 30, showMilestone: true },
    ],
  });
  const layout = layoutSalesMilestones(o);
  assert.equal(layout.markers.length, 6);
  assert.equal(layout.labelRows, 3);
  assertLabelLayout(layout);
  for (const marker of layout.markers) {
    assert(marker.labelRow !== null);
    assert(Math.abs(marker.hitWidth - ((270 / 364) / 326) * 100) < 1e-12);
  }
});

test("More than six milestones keep every marker and label distributed representatives", () => {
  const o = offering({
    end: "2026-10-15",
    targets: Array.from({ length: 15 }, (_, index) => ({
      date: addDays("2026-10-01", index),
      count: index * 2,
      showMilestone: true,
    })),
  });
  const before = structuredClone(o);
  const layout = layoutSalesMilestones(o);
  assert.equal(layout.markers.length, o.targets.length);
  assert.deepEqual(layout.markers.filter((marker) => marker.labelRow !== null).map((marker) => marker.index), [0, 3, 6, 8, 11, 14]);
  for (const marker of layout.markers) {
    assert.equal(marker.target, o.targets[marker.index]);
    assert.equal(marker.label, salesMilestoneLabel(o.targets[marker.index].count, o.unit));
  }
  assertLabelLayout(layout);
  assert.deepEqual(o, before);
});

test("Selected milestone replaces the nearest internal representative without losing endpoints", () => {
  const o = offering({
    end: "2026-10-15",
    targets: Array.from({ length: 15 }, (_, index) => ({
      date: addDays("2026-10-01", index),
      count: index * 2,
      showMilestone: true,
    })),
  });
  for (const target of o.targets) {
    const layout = layoutSalesMilestones(o, target.date);
    const labelled = layout.markers.filter((marker) => marker.labelRow !== null);
    assert.equal(layout.markers.length, 15);
    assert.equal(labelled.length, 6);
    assert(labelled.some((marker) => marker.target === target));
    assert.equal(labelled[0].index, 0);
    assert.equal(labelled.at(-1).index, 14);
    assertLabelLayout(layout);
  }
  const selected = layoutSalesMilestones(o, o.targets[4].date);
  assert.deepEqual(selected.markers.filter((marker) => marker.labelRow !== null).map((marker) => marker.index), [0, 4, 6, 8, 11, 14]);
  assert.deepEqual(layoutSalesMilestones(o, "2026-09-30"), layoutSalesMilestones(o));
  const hidden = { ...o, targets: o.targets.map((target, index) => ({ ...target, showMilestone: index !== 4 })) };
  assert.deepEqual(layoutSalesMilestones(hidden, o.targets[4].date), layoutSalesMilestones(hidden));
});

test("Sales helpers do not mutate frozen offerings, target arrays, or targets", () => {
  const o = offering();
  o.targets.forEach(Object.freeze);
  Object.freeze(o.targets);
  Object.freeze(o);
  assert.doesNotThrow(() => forecastPoints(o));
  assert.doesNotThrow(() => expectedSalesAt(o, "2026-10-03"));
  assert.doesNotThrow(() => salesMilestones(o));
  assert.doesNotThrow(() => nextSalesTarget(o));
  assert.doesNotThrow(() => layoutSalesMilestones(o, "2026-10-05"));
});
