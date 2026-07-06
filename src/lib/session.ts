import { randomBytes } from "node:crypto";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { db } from "@/lib/db";
import { isRole } from "@/lib/roles";
import type { SessionUser } from "@/lib/types";

export type { SessionUser };

// Server-only: only imported inside server-function handlers (see lib/auth.ts).
const COOKIE = "loxhelp_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function toSessionUser(u: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  classId: string | null;
}): SessionUser {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: isRole(u.role) ? u.role : "STUDENT",
    classId: u.classId,
  };
}

/** Create a DB-backed session for a user and set the cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE_S * 1000);
  await db.session.create({ data: { token, userId, expiresAt } });
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
    secure: process.env.NODE_ENV === "production",
  });
}

/** Look up the signed-in user from the session cookie, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getCookie(COOKIE);
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { token } }).catch(() => {});
    return null;
  }
  return toSessionUser(session.user);
}

/** Destroy the current session (logout). */
export async function destroySession(): Promise<void> {
  const token = getCookie(COOKIE);
  if (token) {
    await db.session.deleteMany({ where: { token } });
  }
  setCookie(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
