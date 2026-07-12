import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db";
import { isRole } from "@/lib/roles";
import { verifyPassword } from "@/lib/password";
import type { SessionUser } from "@/lib/types";

export type { SessionUser };

/** Returns the signed-in user (or null). Used to hydrate router context. */
export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    const { getSessionUser } = await import("@/lib/session");
    return getSessionUser();
  },
);

const credentials = z.object({
  email: z.string().email("Zadejte platný email."),
  password: z.string().min(1, "Zadejte heslo."),
});

// Brute-force protection: after MAX_ATTEMPTS failed logins for an account
// within WINDOW_MS, further attempts (even with the right password) are
// rejected until the oldest failure in the window ages out.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export const login = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => credentials.parse(data))
  .handler(async ({ data }): Promise<SessionUser> => {
    const email = data.email.toLowerCase();
    const windowStart = new Date(Date.now() - WINDOW_MS);

    await db.failedLogin.deleteMany({ where: { email, createdAt: { lt: windowStart } } });
    const recentFailures = await db.failedLogin.count({ where: { email } });
    if (recentFailures >= MAX_ATTEMPTS) {
      throw new Error("Příliš mnoho neúspěšných pokusů. Zkuste to znovu za 15 minut.");
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(data.password, user.passwordHash)) {
      await db.failedLogin.create({ data: { email } });
      throw new Error("Neplatný email nebo heslo.");
    }

    await db.failedLogin.deleteMany({ where: { email } });
    const { createSession } = await import("@/lib/session");
    await createSession(user.id);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: isRole(user.role) ? user.role : "STUDENT",
      classId: user.classId,
      mustChangePassword: user.mustChangePassword,
    };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { destroySession } = await import("@/lib/session");
  await destroySession();
  return { ok: true };
});
