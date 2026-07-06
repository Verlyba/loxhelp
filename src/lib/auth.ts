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

export const login = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => credentials.parse(data))
  .handler(async ({ data }): Promise<SessionUser> => {
    const user = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user || !verifyPassword(data.password, user.passwordHash)) {
      throw new Error("Neplatný email nebo heslo.");
    }
    const { createSession } = await import("@/lib/session");
    await createSession(user.id);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: isRole(user.role) ? user.role : "STUDENT",
      classId: user.classId,
    };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { destroySession } = await import("@/lib/session");
  await destroySession();
  return { ok: true };
});
