export const categories = ['Experiencias', 'Cursos', 'Workshops', 'Giftcard'] as const;
export const platforms = ['Meta', 'Google', 'TikTok'] as const;
export const milestones = ['Inicio', 'Material', 'Revisión', 'Objetivo'] as const;
export type Category = typeof categories[number];
export type Platform = typeof platforms[number];
export type Profile = { id: string; name: string; email: string; role: 'admin' | 'collaborator'; status: 'invited' | 'active' | 'disabled'; invitedAt?: string };
export type Target = { date: string; count: number };
export type Offering = {
  id: string; name: string; category: Category; price: number; billing: 'Por inscripción' | 'Mensual' | 'Por unidad';
  description: string; start: string; end: string; goal: number; unit: string;
  budgets: Record<Platform, number>; enabledPlatforms: Platform[]; targets: Target[];
  ownerId: string; memberIds: string[]; milestoneDates: string[]; driveUrl: string; createdAt: string;
};
export type Entry = { id: string; date: string; platform: Platform; queries: number; closed: number; spent: number };
export type Task = { id: string; title: string; milestone: number; ownerId: string; ownerName: string; start: string; end: string; blocked: boolean; subtasks: { title: string; done: boolean }[] };
export type Bundle = { offerings: Offering[]; tasks: Record<string, Task[]>; entries: Record<string, Entry[]>; profiles: Profile[] };
