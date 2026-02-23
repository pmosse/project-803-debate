export function isPrivilegedRole(role: string | undefined): boolean {
  return role === "professor" || role === "super_admin";
}
