import {
  addDays,
  dayCount,
  isoDate,
  parseDate,
  shortDate,
  taskState,
  today,
  validDate,
} from "./domain.ts";
import { milestones } from "./model.ts";
import type {
  Offering,
  Profile,
  Subtask,
  Task,
  TaskColor,
  TaskStatus,
} from "./model.ts";

export type TimelineRow = {
  id: string;
  title: string;
  start: string;
  end: string;
  progress: number;
  color: TaskColor;
  status: TaskStatus;
  ownerName?: string;
  inheritedDates?: boolean;
};
export type PlanningMode = "week" | "month";

export function periodFor(date: string, mode: PlanningMode) {
  const reference = parseDate(date);
  const start =
    mode === "week"
      ? addDays(date, -((reference.getDay() + 6) % 7))
      : isoDate(new Date(reference.getFullYear(), reference.getMonth(), 1));
  const end =
    mode === "week"
      ? addDays(start, 6)
      : isoDate(new Date(reference.getFullYear(), reference.getMonth() + 1, 0));
  const labels: string[] = [];
  for (
    let offset = 0;
    offset < dayCount(start, end);
    offset += mode === "week" ? 1 : 7
  ) {
    labels.push(shortDate(addDays(start, offset)));
  }
  return { start, end, labels };
}

export function shiftPeriod(date: string, mode: PlanningMode, offset: number) {
  if (mode === "week") return addDays(date, offset * 7);
  const reference = parseDate(date);
  const target = new Date(
    reference.getFullYear(),
    reference.getMonth() + offset,
    1,
    12,
  );
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate();
  target.setDate(Math.min(reference.getDate(), lastDay));
  return isoDate(target);
}

export function taskStatus(task: Task): TaskStatus {
  const { percentage } = taskState(task);
  if (
    task.blocked ||
    task.status === "blocked" ||
    task.subtasks.some((sub) => sub.status === "blocked" && !sub.done)
  )
    return "blocked";
  if (percentage === 100) return "completed";
  return percentage > 0 || task.status === "in_progress"
    ? "in_progress"
    : "pending";
}

export function subtaskProgress(sub: Subtask): number {
  if (sub.done || sub.status === "completed") return 100;
  if (sub.status === "pending") return 0;
  return Math.max(
    0,
    Math.min(100, Number.isFinite(sub.progress) ? sub.progress! : 0),
  );
}

export function taskRows(tasks: Task[]): TimelineRow[] {
  return tasks
    .filter((task) => !task.parentId)
    .map((task) => ({
      id: task.id,
      title: task.title,
      start: task.start,
      end: task.end,
      progress: taskState(task).percentage,
      color: task.color ?? "violet",
      status: taskStatus(task),
      ownerName: task.ownerName,
    }))
    .sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        a.end.localeCompare(b.end) ||
        a.id.localeCompare(b.id),
    );
}

export function subtaskRows(
  task: Task,
  profiles: Profile[] = [],
): TimelineRow[] {
  return task.subtasks.map((sub, index) => {
    const progress = subtaskProgress(sub);
    const status: TaskStatus =
      sub.done || sub.status === "completed"
        ? "completed"
        : sub.status === "blocked"
          ? "blocked"
          : progress === 100
            ? "completed"
            : progress > 0 || sub.status === "in_progress"
              ? "in_progress"
              : "pending";
    return {
      id: `${task.id}:${sub.id ?? index}`,
      title: sub.title,
      start: sub.start || task.start,
      end: sub.end || task.end,
      progress,
      color: task.color ?? "violet",
      status,
      ownerName: sub.ownerId
        ? profiles.find((profile) => profile.id === sub.ownerId)?.name
        : task.ownerName,
      inheritedDates: !sub.start || !sub.end,
    };
  });
}

export function timelinePlacement(
  row: TimelineRow,
  start: string,
  end: string,
) {
  const hidden = {
    visible: false,
    left: 0,
    width: 0,
    fill: 0,
    continuesBefore: false,
    continuesAfter: false,
  };
  if (
    ![row.start, row.end, start, end].every(validDate) ||
    end < start ||
    row.end < row.start ||
    row.end < start ||
    row.start > end
  ) {
    return hidden;
  }
  const visibleStart = row.start < start ? start : row.start;
  const visibleEnd = row.end > end ? end : row.end;
  const totalDays = dayCount(row.start, row.end);
  const visibleDays = dayCount(visibleStart, visibleEnd);
  const periodDays = dayCount(start, end);
  const skippedDays = dayCount(row.start, visibleStart) - 1;
  const progress = Math.max(
    0,
    Math.min(100, Number.isFinite(row.progress) ? row.progress : 0),
  );
  // Progress occupies a prefix of the full task, not of the clipped bar.
  const completedDays = Math.max(
    0,
    Math.min(visibleDays, (totalDays * progress) / 100 - skippedDays),
  );
  return {
    visible: true,
    left: ((dayCount(start, visibleStart) - 1) / periodDays) * 100,
    width: (visibleDays / periodDays) * 100,
    fill: (completedDays / visibleDays) * 100,
    continuesBefore: row.start < start,
    continuesAfter: row.end > end,
  };
}

export function milestoneItems(offering: Offering, tasks: Task[]) {
  return milestones.map((name, index) => {
    const linked = tasks.filter((task) => task.milestone === index);
    return {
      index,
      name,
      date: offering.milestoneDates[index],
      completed:
        offering.milestoneCompleted?.[index] ??
        (linked.length > 0 &&
          linked.every((task) => taskStatus(task) === "completed")),
    };
  });
}

export function dependencyWarnings(
  task: Task,
  tasks: Task[],
  current = today(),
): string[] {
  const warnings: string[] = [];
  for (const id of task.predecessorIds ?? []) {
    const predecessor = tasks.find((candidate) => candidate.id === id);
    if (!predecessor) {
      warnings.push(`No se encuentra la dependencia "${id}".`);
      continue;
    }
    const name = predecessor.title || predecessor.id;
    const status = taskStatus(predecessor);
    if (status !== "completed") {
      warnings.push(
        `La dependencia "${name}" esta ${status === "blocked" ? "bloqueada" : "incompleta"}.`,
      );
      if (predecessor.end < current) {
        warnings.push(
          `La dependencia "${name}" esta vencida (fin: ${shortDate(predecessor.end)}).`,
        );
      }
    }
    if (predecessor.end >= task.start) {
      warnings.push(
        `Las fechas de la dependencia "${name}" se solapan con el inicio de "${task.title}" (${shortDate(task.start)}).`,
      );
    }
  }
  return warnings;
}
