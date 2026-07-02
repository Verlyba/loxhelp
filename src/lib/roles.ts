// SQLite has no native enums, so roles/themes are strings validated here and
// shared across client + server. Keep these in sync with the Prisma schema.

export const ROLES = ["ADMIN", "TEACHER", "STUDENT"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Admins and teachers manage content; students only consume their own. */
export function isStaff(role: Role): boolean {
  return role === "ADMIN" || role === "TEACHER";
}

export const SUBJECT_THEMES = ["loxone", "cad3d", "default"] as const;
export type SubjectTheme = (typeof SUBJECT_THEMES)[number];

export function asTheme(value: string): SubjectTheme {
  return (SUBJECT_THEMES as readonly string[]).includes(value)
    ? (value as SubjectTheme)
    : "default";
}

export function roleLabel(role: Role): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}
