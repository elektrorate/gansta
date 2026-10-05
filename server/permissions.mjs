export function requireActive(profile, verified) {
  if (!verified || !profile || profile.status !== "active")
    throw Object.assign(
      new Error("Tu cuenta no tiene acceso activo y verificado."),
      { status: 403 },
    );
}
export function requireAdmin(profile) {
  if (profile?.status !== "active" || profile.role !== "admin")
    throw Object.assign(new Error("Acción reservada a administradores."), {
      status: 403,
    });
}
export function validateUserChange(actorId, targetId, change) {
  if (actorId === targetId)
    throw Object.assign(new Error("No puedes modificar tu propio acceso."), {
      status: 400,
    });
  if (
    !["admin", "collaborator"].includes(change.role) ||
    !["active", "invited", "disabled"].includes(change.status)
  )
    throw Object.assign(new Error("Rol o estado no válido."), { status: 400 });
}
export { taskProgressOnly } from "../shared/domain.ts";
