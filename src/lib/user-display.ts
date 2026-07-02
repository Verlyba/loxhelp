import type { SessionUser } from "@/lib/types";

export const fullName = (u: Pick<SessionUser, "firstName" | "lastName">) =>
  `${u.firstName} ${u.lastName}`.trim();

export const initials = (u: Pick<SessionUser, "firstName" | "lastName">) =>
  ((u.firstName[0] ?? "") + (u.lastName[0] ?? "")).toUpperCase();
