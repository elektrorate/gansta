export const categories = [
  "Experiencias",
  "Cursos",
  "Workshops",
  "Giftcard",
] as const;
export const platforms = ["Meta", "Google", "TikTok"] as const;
export const milestones = [
  "Inicio",
  "Material",
  "Revisión",
  "Objetivo",
] as const;
export type Category = (typeof categories)[number];
export type Platform = (typeof platforms)[number];
export type Profile = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "collaborator";
  status: "invited" | "active" | "disabled";
  invitedAt?: string;
};
export type Target = { date: string; count: number; showMilestone?: boolean };
export type TaskStatus = "pending" | "in_progress" | "completed" | "blocked";
export type TaskColor = "violet" | "orange" | "blue" | "green";
export type Priority = "low" | "medium" | "high" | "critical";
export type Subtask = {
  id?: string;
  title: string;
  done: boolean;
  start?: string;
  end?: string;
  ownerId?: string;
  progress?: number;
  status?: TaskStatus;
};
export type Offering = {
  id: string;
  name: string;
  category: Category;
  campaignName?: string;
  price: number;
  billing: "Por inscripción" | "Mensual" | "Por unidad";
  description: string;
  externalUrl?: string;
  planningDescription?: string;
  start: string;
  end: string;
  goal: number;
  unit: string;
  budgets: Record<Platform, number>;
  enabledPlatforms: Platform[];
  targets: Target[];
  ownerId: string;
  memberIds: string[];
  milestoneDates: string[];
  milestoneCompleted?: (boolean | null)[];
  driveUrl: string;
  createdAt: string;
};
export type Entry = {
  id: string;
  date: string;
  platform: Platform;
  queries: number;
  closed: number;
  spent: number;
};
export type Task = {
  id: string;
  title: string;
  milestone: number;
  ownerId: string;
  ownerName: string;
  start: string;
  end: string;
  blocked: boolean;
  subtasks: Subtask[];
  parentId?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  predecessorIds?: string[];
  isMilestone?: boolean;
  createdAt?: string;
  updatedAt?: string;
  progress?: number;
  color?: TaskColor;
};
export type Bundle = {
  offerings: Offering[];
  tasks: Record<string, Task[]>;
  entries: Record<string, Entry[]>;
  profiles: Profile[];
};
