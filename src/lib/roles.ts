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

// Themes are named by color, not by course — a course picks whichever color
// suits it, independent of subject matter. "loxone"/"cad3d" are legacy keys
// from before the rename; asTheme() maps them onto their color equivalents
// so subjects created under the old scheme keep rendering correctly.
export const SUBJECT_THEMES = [
  "default",
  "green",
  "blue",
  "purple",
  "orange",
  "red",
  "pink",
  "teal",
  "sunset",
  "ocean",
  "aurora",
] as const;
export type SubjectTheme = (typeof SUBJECT_THEMES)[number];

const LEGACY_THEME_ALIASES: Record<string, SubjectTheme> = {
  loxone: "green",
  cad3d: "blue",
};

export function asTheme(value: string): SubjectTheme {
  if ((SUBJECT_THEMES as readonly string[]).includes(value)) return value as SubjectTheme;
  return LEGACY_THEME_ALIASES[value] ?? "default";
}

export const GRADIENT_THEMES = new Set<SubjectTheme>(["sunset", "ocean", "aurora"]);

/** Swatch colors for the theme picker UI — solid themes get one color, gradients two. */
export const THEME_META: Record<
  SubjectTheme,
  { label: string; swatch: [string] | [string, string] }
> = {
  default: { label: "Šedá", swatch: ["oklch(0.42 0.02 260)"] },
  green: { label: "Zelená", swatch: ["oklch(0.68 0.19 142)"] },
  blue: { label: "Modrá", swatch: ["oklch(0.58 0.17 245)"] },
  purple: { label: "Fialová", swatch: ["oklch(0.55 0.2 300)"] },
  orange: { label: "Oranžová", swatch: ["oklch(0.68 0.19 45)"] },
  red: { label: "Červená", swatch: ["oklch(0.58 0.22 25)"] },
  pink: { label: "Růžová", swatch: ["oklch(0.65 0.19 355)"] },
  teal: { label: "Tyrkysová", swatch: ["oklch(0.62 0.13 195)"] },
  sunset: { label: "Západ slunce", swatch: ["oklch(0.68 0.19 45)", "oklch(0.65 0.19 355)"] },
  ocean: { label: "Oceán", swatch: ["oklch(0.58 0.17 245)", "oklch(0.62 0.13 195)"] },
  aurora: { label: "Polární záře", swatch: ["oklch(0.55 0.2 300)", "oklch(0.68 0.19 142)"] },
};

export function roleLabel(role: Role): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}
