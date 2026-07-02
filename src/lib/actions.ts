import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { generatePairsCore } from "@/lib/pairing";
import { isStaff, ROLES } from "@/lib/roles";
import type { SessionUser } from "@/lib/types";

async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw redirect({ to: "/auth" });
  return user;
}

async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaff(user.role)) throw new Error("Tato akce vyžaduje práva učitele.");
  return user;
}

// --- file upload (students submit to their group, versioned) ---

const UPLOAD_ROOT = "uploads";

export const uploadSubmission = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Očekávána data formuláře.");
    const groupId = data.get("groupId");
    const file = data.get("file");
    const note = data.get("note");
    if (typeof groupId !== "string" || !groupId) throw new Error("Chybí skupina.");
    if (!(file instanceof File) || file.size === 0) throw new Error("Vyberte soubor.");
    return { groupId, file, note: typeof note === "string" && note ? note : null };
  })
  .handler(async ({ data }) => {
    const user = await requireUser();

    const group = await db.group.findUnique({
      where: { id: data.groupId },
      include: { members: { select: { userId: true } } },
    });
    if (!group) throw new Error("Skupina nenalezena.");

    const isMember = group.members.some((m) => m.userId === user.id);
    if (!isMember && !isStaff(user.role)) {
      throw new Error("Nahrávat můžete jen do své vlastní skupiny.");
    }

    const last = await db.submission.findFirst({
      where: { groupId: group.id },
      orderBy: { version: "desc" },
    });
    const version = (last?.version ?? 0) + 1;

    const safeName = data.file.name.replace(/[^\w.-]+/g, "_").slice(-80) || "soubor";
    const fileKey = `${UPLOAD_ROOT}/${group.id}/v${version}__${safeName}`;
    const abs = resolve(process.cwd(), fileKey);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, Buffer.from(await data.file.arrayBuffer()));

    await db.submission.create({
      data: {
        version,
        fileName: data.file.name,
        fileKey,
        fileSize: data.file.size,
        mimeType: data.file.type || "application/octet-stream",
        note: data.note,
        uploadedById: user.id,
        groupId: group.id,
      },
    });

    return { version };
  });

export const downloadSubmission = createServerFn({ method: "GET" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    const user = await requireUser();
    const sub = await db.submission.findUnique({
      where: { id },
      include: { group: { include: { members: { select: { userId: true } } } } },
    });
    if (!sub) throw new Error("Soubor nenalezen.");

    const allowed = isStaff(user.role) || sub.group.members.some((m) => m.userId === user.id);
    if (!allowed) throw new Error("K tomuto souboru nemáte přístup.");

    const buf = readFileSync(resolve(process.cwd(), sub.fileKey));
    return {
      fileName: sub.fileName,
      mimeType: sub.mimeType,
      dataBase64: buf.toString("base64"),
    };
  });

export const downloadCourseFile = createServerFn({ method: "GET" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    const user = await requireUser();
    const file = await db.subjectFile.findUnique({
      where: { id },
      include: { page: { include: { subject: true } } },
    });
    if (!file) throw new Error("Soubor nenalezen.");

    if (!isStaff(user.role)) {
      const enrolled = await db.enrollment.findUnique({
        where: { userId_subjectId: { userId: user.id, subjectId: file.page.subject.id } },
      });
      if (!enrolled) throw new Error("K tomuto předmětu a jeho souborům nemáte přístup.");
    }

    const buf = readFileSync(resolve(process.cwd(), file.fileKey));
    return {
      fileName: file.fileName,
      mimeType: file.mimeType,
      dataBase64: buf.toString("base64"),
    };
  });

// --- staff content management ---

export const createClass = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().min(1), schoolYear: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const created = await db.class.create({ data });
    return { id: created.id };
  });

export const setClassArchived = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string(), isArchived: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    await requireStaff();
    await db.class.update({ where: { id: data.id }, data: { isArchived: data.isArchived } });
    return { ok: true };
  });

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const createSubject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1),
        description: z.string().default(""),
        themeStyle: z.enum(["loxone", "cad3d", "default"]),
        classId: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    let slug = slugify(data.name) || "predmet";
    if (await db.subject.findUnique({ where: { slug } }))
      slug = `${slug}-${Date.now().toString(36)}`;
    const created = await db.subject.create({ data: { ...data, slug } });
    return { id: created.id, slug };
  });

export const createSubjectPage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        subjectId: z.string().min(1),
        title: z.string().min(1),
        template: z.enum(["content", "assignments"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    let slug = slugify(data.title) || "stranka";
    const clash = await db.subjectPage.findFirst({
      where: { subjectId: data.subjectId, slug },
    });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;
    const last = await db.subjectPage.findFirst({
      where: { subjectId: data.subjectId },
      orderBy: { order: "desc" },
    });
    const created = await db.subjectPage.create({
      data: {
        subjectId: data.subjectId,
        title: data.title,
        slug,
        template: data.template,
        order: (last?.order ?? -1) + 1,
      },
    });
    return { id: created.id, slug: created.slug };
  });

export const updateSubjectPage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        content: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    await db.subjectPage.update({
      where: { id: data.id },
      data: { title: data.title, content: data.content },
    });
    return { ok: true };
  });

export const deleteSubjectPage = createServerFn({ method: "POST" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    await requireStaff();
    await db.subjectPage.delete({ where: { id } });
    return { ok: true };
  });

export const createAssignment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        subjectId: z.string().min(1),
        title: z.string().min(1),
        description: z.string().default(""),
        dueDate: z.string().min(1), // ISO from <input type=datetime-local>
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const created = await db.assignment.create({
      data: {
        subjectId: data.subjectId,
        title: data.title,
        description: data.description,
        dueDate: new Date(data.dueDate),
      },
    });
    return { id: created.id };
  });

export const createGroup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        assignmentId: z.string().min(1),
        name: z.string().min(1),
        memberIds: z.array(z.string()).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const group = await db.group.create({
      data: {
        assignmentId: data.assignmentId,
        name: data.name,
        members: { create: data.memberIds.map((userId) => ({ userId })) },
      },
    });
    return { id: group.id };
  });

export const generatePairs = createServerFn({ method: "POST" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: assignmentId }) => {
    await requireStaff();
    return generatePairsCore(assignmentId);
  });

export const createUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        role: z.enum(ROLES),
        password: z.string().min(4),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const email = data.email.toLowerCase();
    if (await db.user.findUnique({ where: { email } })) {
      throw new Error("Uživatel s tímto emailem už existuje.");
    }
    const created = await db.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        role: data.role,
        passwordHash: hashPassword(data.password),
      },
    });
    return { id: created.id };
  });

export const enrollStudents = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ subjectId: z.string().min(1), userIds: z.array(z.string()) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    for (const userId of data.userIds) {
      await db.enrollment.create({ data: { userId, subjectId: data.subjectId } }).catch(() => {}); // ignore duplicates
    }
    return { ok: true };
  });
