import { redirect } from "@tanstack/react-router";
import { isStaff } from "@/lib/roles";
import type { SessionUser } from "@/lib/types";

// Route guards for use in beforeLoad. They throw router redirects, so the types
// narrow nicely after calling them.

export function requireUser(user: SessionUser | null): SessionUser {
  if (!user) throw redirect({ to: "/auth" });
  return user;
}

export function requireStaff(user: SessionUser | null): SessionUser {
  const u = requireUser(user);
  if (!isStaff(u.role)) throw redirect({ to: "/" });
  return u;
}

/** For the login page: bounce already-authenticated users to the dashboard. */
export function redirectIfAuthed(user: SessionUser | null): void {
  if (user) throw redirect({ to: "/" });
}
