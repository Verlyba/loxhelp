import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db";
import { isRole } from "@/lib/roles";
import { verifyPassword } from "@/lib/password";
import { createSession, destroySession, getSessionUser, type SessionUser } from "@/lib/session";

export type { SessionUser };

/** Returns the signed-in user (or null). Used to hydrate router context. */
export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    return getSessionUser();
  },
);

const credentials = z.object({
  email: z.string().email("Zadejte platný email."),
  password: z.string().min(1, "Zadejte heslo."),
});

export const login = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => credentials.parse(data))
  .handler(async ({ data }): Promise<SessionUser> => {
    const user = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user || !verifyPassword(data.password, user.passwordHash)) {
      throw new Error("Neplatný email nebo heslo.");
    }
    await createSession(user.id);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: isRole(user.role) ? user.role : "STUDENT",
    };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { ok: true };
});
