import { categories, platforms } from './model.ts';
import type { Entry, Offering, Profile, Task } from './model.ts';

export const today = () => isoDate(new Date());
export function isoDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function parseDate(s: string) { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d,12); }
export function validDate(s: unknown): s is string { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isoDate(parseDate(s)) === s; }
export function addDays(s: string, n: number) { const d=parseDate(s);d.setDate(d.getDate()+n);return isoDate(d); }
export function dayCount(start: string, end: string) { return Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000)+1; }
export function weeklyTargets(start: string, end: string, goal: number) {
  if(!validDate(start)||!validDate(end)||end<start||dayCount(start,end)>3660)return [];
  const days=dayCount(start,end), result=[];
  for(let n=7;n<days+7;n+=7){const elapsed=Math.min(n,days);result.push({date:addDays(start,elapsed-1),count:Math.round(goal*elapsed/days)});if(elapsed===days)break;}
  return result;
}
export const money = (cents: number) => (cents/100).toLocaleString('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:2});
export const shortDate = (s: string) => validDate(s) ? parseDate(s).toLocaleDateString('es-ES',{day:'numeric',month:'short'}) : '—';
export const totalBudget = (o: Offering) => o.enabledPlatforms.reduce((sum,p)=>sum+o.budgets[p],0);
export function totals(entries: Entry[], start='0000', end='9999') { return entries.filter(e=>e.date>=start&&e.date<=end).reduce((a,e)=>({queries:a.queries+e.queries,closed:a.closed+e.closed,spent:a.spent+e.spent}),{queries:0,closed:0,spent:0}); }
export function stage(actual: number, goal: number) { const percentage=goal>0?Math.round(actual/goal*100):0;return { percentage, color:percentage>=100?'green':percentage>=80?'blue':percentage>=50?'yellow':percentage>0?'orange':'gray', label:percentage>=100?'Objetivo conseguido':percentage>=80?'Cerca del objetivo':percentage>=50?'Avanzado':percentage>0?'En progreso':'Sin avance' }; }
export function taskState(t: Task) { const count=t.subtasks.filter(s=>s.done).length, percentage=t.subtasks.length?Math.round(count/t.subtasks.length*100):0;return {count,percentage,label:t.blocked?'Bloqueada':percentage===100?'Completada':percentage?'En proceso':'Pendiente'}; }
export function driveLink(url: string) { if(!url)return true;try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='drive.google.com'&&/^\/drive\/(?:u\/\d+\/)?folders\/[\w-]+/.test(u.pathname)}catch{return false} }
export function canView(p: Profile, o: Offering) { return p.status==='active'&&(p.role==='admin'||o.memberIds.includes(p.id)); }
export function canEditTask(p: Profile, o: Offering, t: Task) { return canView(p,o)&&(p.role==='admin'||t.ownerId===p.id); }
function assert(ok: unknown, message: string): asserts ok { if(!ok)throw new Error(message); }
function integer(v: unknown) { return Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=100_000_000; }
export function validateOffering(o: Offering) {
  assert(typeof o.name==='string'&&o.name.trim().length>0&&o.name.length<=100,'Introduce un nombre de hasta 100 caracteres.');
  assert(categories.includes(o.category),'Categoría no válida.');
  assert(integer(o.price),'El precio debe ser positivo o cero.');
  assert(['Por inscripción','Mensual','Por unidad'].includes(o.billing),'Tipo de cobro no válido.');
  assert(typeof o.description==='string'&&o.description.length<=2000,'La descripción es demasiado larga.');
  assert(typeof o.unit==='string'&&o.unit.length>0&&o.unit.length<=40,'Define el tipo de objetivo.');
  assert(validDate(o.start)&&validDate(o.end)&&o.end>=o.start&&dayCount(o.start,o.end)<=3660,'Revisa las fechas del periodo (máximo diez años).');
  assert(integer(o.goal)&&o.goal>0,'El objetivo debe ser un número entero mayor que cero.');
  assert(Array.isArray(o.enabledPlatforms)&&new Set(o.enabledPlatforms).size===o.enabledPlatforms.length&&o.enabledPlatforms.every(p=>platforms.includes(p)),'Plataformas no válidas.');
  assert(o.budgets&&platforms.every(p=>integer(o.budgets[p])),'Revisa el presupuesto de cada plataforma.');
  assert(Array.isArray(o.targets)&&o.targets.length>0&&o.targets.length<=524,'Define las metas de ventas.');
  assert(o.targets.every((t,i)=>validDate(t.date)&&t.date>=o.start&&t.date<=o.end&&integer(t.count)&&t.count<=o.goal&&(!i||(t.date>o.targets[i-1].date&&t.count>=o.targets[i-1].count))),'Las metas deben tener fechas ordenadas y cantidades acumuladas.');
  assert(o.targets.at(-1)?.count===o.goal&&o.targets.at(-1)?.date===o.end,'La última meta debe coincidir con el objetivo y la fecha de fin.');
  assert(Array.isArray(o.milestoneDates)&&o.milestoneDates.length===4&&o.milestoneDates.every((s,i)=>validDate(s)&&s>=o.start&&s<=o.end&&(!i||s>=o.milestoneDates[i-1])),'Ordena los cuatro hitos dentro del periodo.');
  assert(typeof o.ownerId==='string'&&o.ownerId.length>0&&Array.isArray(o.memberIds)&&o.memberIds.length<=50&&o.memberIds.every(id=>typeof id==='string')&&o.memberIds.includes(o.ownerId),'Asigna un responsable y un equipo válido.');
  assert(typeof o.driveUrl==='string'&&driveLink(o.driveUrl),'Introduce un enlace válido de carpeta de Google Drive.');
  return o;
}
export function validateEntry(e: Entry, o: Offering) {
  assert(validDate(e.date)&&e.date>=o.start&&e.date<=o.end,'El día debe estar dentro del periodo del offering.');
  assert(e.date<=today(),'No puedes registrar resultados en una fecha futura.');
  assert(o.enabledPlatforms.includes(e.platform),'La plataforma no está habilitada en este offering.');
  assert(integer(e.queries)&&integer(e.closed)&&integer(e.spent),'Los resultados deben ser positivos o cero; consultas y cierres, enteros.');
  return e;
}
export function validateTask(t: Task, o: Offering) {
  assert(typeof t.title==='string'&&t.title.trim().length>0&&t.title.length<=150,'Escribe un título para la tarea.');
  assert(Number.isInteger(t.milestone)&&t.milestone>=0&&t.milestone<4,'Hito no válido.');
  assert(validDate(t.start)&&validDate(t.end)&&t.start>=o.start&&t.end<=o.end&&t.end>=t.start,'Las fechas de la tarea deben estar dentro del offering.');
  assert(o.memberIds.includes(t.ownerId),'El responsable debe formar parte del equipo.');
  assert(typeof t.blocked==='boolean'&&Array.isArray(t.subtasks)&&t.subtasks.length>0&&t.subtasks.length<=50&&t.subtasks.every(s=>typeof s.title==='string'&&s.title.trim().length>0&&s.title.length<=150&&typeof s.done==='boolean'),'Añade al menos una subtarea válida.');
  return t;
}
