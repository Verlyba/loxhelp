import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { generatePairsInGroupCore } from "@/lib/pairing";
import { isStaff, ROLES } from "@/lib/roles";
import type { SessionUser, TargetType } from "@/lib/types";

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw redirect({ to: "/auth" });
  return user;
}

export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaff(user.role)) throw new Error("Tato akce vyžaduje práva učitele.");
  return user;
}

// Transaction client type (the `tx` passed to db.$transaction's callback).
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  targetName?: string;
  oldValue?: string | null;
  newValue?: string | null;
  meta?: string | null;
}

/** Writes one AuditLog row inside the caller's transaction (PRD §5C). */
async function writeAudit(tx: Tx, actorId: string, e: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      targetName: e.targetName ?? "",
      oldValue: e.oldValue ?? null,
      newValue: e.newValue ?? null,
      meta: e.meta ?? null,
    },
  });
}

// --- submissions (upload/download per unit) ---

const UPLOAD_ROOT = "uploads";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

function assertFileSize(file: File): void {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Soubor je příliš velký (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit je 50 MB — velké projekty zabalte do ZIP.`,
    );
  }
}

/**
 * Resolves the unit a student submits as for an assignment: themselves,
 * their pair, or their study group — depending on the assignment target.
 */
async function resolveUnit(
  userId: string,
  subjectId: string,
  targetType: TargetType,
): Promise<{ unitKey: string; userId?: string; pairId?: string; studyGroupId?: string }> {
  if (targetType === "INDIVIDUAL") return { unitKey: `u:${userId}`, userId };
  if (targetType === "PAIR") {
    const pm = await db.pairMember.findFirst({
      where: { userId, pair: { studyGroup: { subjectId } } },
    });
    if (!pm) throw new Error("Nejste zařazeni do dvojice — požádejte vyučujícího.");
    return { unitKey: `p:${pm.pairId}`, pairId: pm.pairId };
  }
  const gm = await db.studyGroupMember.findFirst({
    where: { userId, studyGroup: { subjectId } },
  });
  if (!gm) throw new Error("Nejste zařazeni do učební skupiny — požádejte vyučujícího.");
  return { unitKey: `g:${gm.studyGroupId}`, studyGroupId: gm.studyGroupId };
}

export const uploadSubmission = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Očekávána data formuláře.");
    const assignmentId = data.get("assignmentId");
    const file = data.get("file");
    const note = data.get("note");
    if (typeof assignmentId !== "string" || !assignmentId) throw new Error("Chybí úkol.");
    if (!(file instanceof File) || file.size === 0) throw new Error("Vyberte soubor.");
    assertFileSize(file);
    return { assignmentId, file, note: typeof note === "string" && note ? note : null };
  })
  .handler(async ({ data }) => {
    const user = await requireUser();

    const assignment = await db.assignment.findUnique({
      where: { id: data.assignmentId },
      select: {
        id: true,
        subjectId: true,
        targetType: true,
        isPublished: true,
        requiresConsent: true,
      },
    });
    if (!assignment) throw new Error("Úkol nenalezen.");
    if (!assignment.isPublished && !isStaff(user.role)) {
      throw new Error("Úkol zatím není zadaný.");
    }

    const enrolled = await db.enrollment.findUnique({
      where: { userId_subjectId: { userId: user.id, subjectId: assignment.subjectId } },
    });
    if (!enrolled && !isStaff(user.role)) throw new Error("Nejste zapsáni v tomto kurzu.");

    if (assignment.requiresConsent && !isStaff(user.role)) {
      const consent = await db.assignmentConsent.findUnique({
        where: {
          assignmentId_userId: {
            assignmentId: assignment.id,
            userId: user.id,
          },
        },
      });
      if (!consent) {
        throw new Error("Před odevzdáním musíte udělit souhlas s podmínkami zadání.");
      }
    }

    const target = (
      assignment.targetType === "PAIR" || assignment.targetType === "GROUP"
        ? assignment.targetType
        : "INDIVIDUAL"
    ) as TargetType;
    const unit = await resolveUnit(user.id, assignment.subjectId, target);

    const last = await db.submission.findFirst({
      where: { assignmentId: assignment.id, unitKey: unit.unitKey },
      orderBy: { version: "desc" },
    });
    const version = (last?.version ?? 0) + 1;

    const safeName = data.file.name.replace(/[^\w.-]+/g, "_").slice(-80) || "soubor";
    const safeUnit = unit.unitKey.replace(":", "_");
    const fileKey = `${UPLOAD_ROOT}/${assignment.id}/${safeUnit}/v${version}__${safeName}`;
    const abs = resolve(process.cwd(), fileKey);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, Buffer.from(await data.file.arrayBuffer()));

    await db.submission.create({
      data: {
        assignmentId: assignment.id,
        version,
        unitKey: unit.unitKey,
        userId: unit.userId,
        pairId: unit.pairId,
        studyGroupId: unit.studyGroupId,
        fileName: data.file.name,
        fileKey,
        fileSize: data.file.size,
        mimeType: data.file.type || "application/octet-stream",
        note: data.note,
        uploadedById: user.id,
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
      include: {
        pair: { include: { members: { select: { userId: true } } } },
        studyGroup: { include: { members: { select: { userId: true } } } },
      },
    });
    if (!sub) throw new Error("Soubor nenalezen.");

    const allowed =
      isStaff(user.role) ||
      sub.userId === user.id ||
      sub.pair?.members.some((m) => m.userId === user.id) ||
      sub.studyGroup?.members.some((m) => m.userId === user.id);
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

// --- grading and submission state management ---

/**
 * Updates grading state (grade, feedback, lock, extension) for every member of
 * a unit. Fields left `undefined` are not touched — the quick grade input can
 * send just the value without wiping feedback. Runs in one transaction so a
 * pair/group never ends up half-graded. Rows that end up fully default are
 * deleted to keep the table clean.
 */
export const updateSubmissionState = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        assignmentId: z.string().min(1),
        userIds: z.array(z.string().min(1)).min(1),
        value: z.string().trim().nullish(), // grade, e.g. "1"; null clears; undefined = keep
        note: z.string().trim().nullish(), // feedback; null clears; undefined = keep
        locked: z.boolean().optional(),
        extension: z.string().trim().nullish(), // ISO string; null clears; undefined = keep
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const actor = await requireStaff();

    // Human-readable target names for the audit trail (read-only, outside tx).
    const users = await db.user.findMany({
      where: { id: { in: data.userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    await db.$transaction(async (tx) => {
      for (const userId of data.userIds) {
        const where = { assignmentId_userId: { assignmentId: data.assignmentId, userId } };
        const existing = await tx.grade.findUnique({ where });

        // Merge: undefined keeps the stored value, null/"" clears it.
        const next = {
          value: data.value === undefined ? (existing?.value ?? null) : data.value || null,
          note: data.note === undefined ? (existing?.note ?? null) : data.note || null,
          locked: data.locked === undefined ? (existing?.locked ?? false) : data.locked,
          extension:
            data.extension === undefined
              ? (existing?.extension ?? null)
              : data.extension
                ? new Date(data.extension)
                : null,
        };

        const isDefault = !next.value && !next.note && !next.locked && !next.extension;
        if (isDefault) {
          if (existing) await tx.grade.delete({ where });
        } else if (existing) {
          await tx.grade.update({ where, data: next });
        } else {
          await tx.grade.create({
            data: { assignmentId: data.assignmentId, userId, ...next },
          });
        }

        // --- audit trail (PRD §5C): one row per changed dimension ---
        const entityId = `${data.assignmentId}:${userId}`;
        const targetName = nameById.get(userId) ?? userId;
        const prevExt = existing?.extension ? existing.extension.toISOString() : null;
        const nextExt = next.extension ? next.extension.toISOString() : null;

        if ((existing?.value ?? null) !== next.value) {
          await writeAudit(tx, actor.id, {
            action: !existing?.value ? "GRADE_SET" : !next.value ? "GRADE_DELETE" : "GRADE_CHANGE",
            entityType: "Grade",
            entityId,
            targetName,
            oldValue: existing?.value ?? null,
            newValue: next.value,
          });
        }
        if ((existing?.note ?? null) !== next.note) {
          await writeAudit(tx, actor.id, {
            action: "FEEDBACK_CHANGE",
            entityType: "Grade",
            entityId,
            targetName,
            oldValue: existing?.note ?? null,
            newValue: next.note,
          });
        }
        if ((existing?.locked ?? false) !== next.locked) {
          await writeAudit(tx, actor.id, {
            action: next.locked ? "SUBMISSION_LOCK" : "SUBMISSION_UNLOCK",
            entityType: "Grade",
            entityId,
            targetName,
            oldValue: String(existing?.locked ?? false),
            newValue: String(next.locked),
          });
        }
        if (prevExt !== nextExt) {
          await writeAudit(tx, actor.id, {
            action: nextExt ? "EXTENSION_SET" : "EXTENSION_CLEAR",
            entityType: "Grade",
            entityId,
            targetName,
            oldValue: prevExt,
            newValue: nextExt,
          });
        }
      }
    });

    return { ok: true };
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
    const base = slugify(data.name) || "predmet";
    // Readable collision handling: predmet, predmet-2, predmet-3, …
    let slug = base;
    for (let n = 2; await db.subject.findUnique({ where: { slug } }); n++) {
      slug = `${base}-${n}`;
    }
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
    const base = slugify(data.title) || "stranka";
    // Readable collision handling: cviceni, cviceni-2, cviceni-3, …
    let slug = base;
    for (
      let n = 2;
      await db.subjectPage.findFirst({ where: { subjectId: data.subjectId, slug } });
      n++
    ) {
      slug = `${base}-${n}`;
    }
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

/** Moves a page up or down in the left panel (swaps order with its neighbour). */
export const movePage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), direction: z.enum(["up", "down"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const page = await db.subjectPage.findUnique({ where: { id: data.id } });
    if (!page) throw new Error("Stránka nenalezena.");

    const pages = await db.subjectPage.findMany({
      where: { subjectId: page.subjectId },
      orderBy: { order: "asc" },
    });
    const idx = pages.findIndex((p) => p.id === page.id);
    const swapWith = data.direction === "up" ? pages[idx - 1] : pages[idx + 1];
    if (!swapWith) return { ok: true }; // already at the edge

    // Renumber the whole list to keep orders unique and gapless.
    const reordered = [...pages];
    [reordered[idx], reordered[pages.indexOf(swapWith)]] = [swapWith, page];
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].order !== i) {
        await db.subjectPage.update({ where: { id: reordered[i].id }, data: { order: i } });
      }
    }
    return { ok: true };
  });

// --- announcements ---

export const createAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        subjectId: z.string().min(1),
        title: z.string().min(1),
        body: z.string().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await requireStaff();
    const created = await db.announcement.create({
      data: { subjectId: data.subjectId, title: data.title, body: data.body, authorId: user.id },
    });
    return { id: created.id };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    await requireStaff();
    await db.announcement.delete({ where: { id } });
    return { ok: true };
  });

// --- assignments ---

export const createAssignment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        subjectId: z.string().min(1),
        title: z.string().min(1),
        description: z.string().default(""),
        dueDate: z.string().min(1), // ISO from <input type=datetime-local>
        targetType: z.enum(["INDIVIDUAL", "PAIR", "GROUP"]),
        isPublished: z.boolean().default(false),
        requiresConsent: z.boolean().default(false),
        consentText: z.string().default(""),
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
        targetType: data.targetType,
        isPublished: data.isPublished,
        requiresConsent: data.requiresConsent,
        consentText: data.consentText,
      },
    });
    return { id: created.id };
  });

/** Publish ("zadat") or unpublish an assignment. */
export const setAssignmentPublished = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), isPublished: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    await db.assignment.update({
      where: { id: data.id },
      data: { isPublished: data.isPublished },
    });
    return { ok: true };
  });

export const recordConsent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        assignmentId: z.string().min(1),
        variant: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();

    const assignment = await db.assignment.findUnique({
      where: { id: data.assignmentId },
      select: { id: true, requiresConsent: true, consentText: true, isPublished: true },
    });
    if (!assignment) throw new Error("Úkol nenalezen.");
    if (!assignment.isPublished) throw new Error("Úkol zatím není zadaný.");
    if (!assignment.requiresConsent) throw new Error("Tento úkol nevyžaduje souhlas.");

    const existing = await db.assignmentConsent.findUnique({
      where: {
        assignmentId_userId: {
          assignmentId: data.assignmentId,
          userId: user.id,
        },
      },
    });
    if (existing) {
      throw new Error("Souhlas pro tento úkol jste již udělili.");
    }

    const consent = await db.assignmentConsent.create({
      data: {
        assignmentId: data.assignmentId,
        userId: user.id,
        acceptedText: assignment.consentText || "Souhlasím se zadáním úkolu.",
        variant: data.variant || null,
      },
    });

    return { ok: true, id: consent.id };
  });

// --- study groups & pairs ---

export const createStudyGroup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ subjectId: z.string().min(1), name: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const created = await db.studyGroup.create({ data });
    return { id: created.id };
  });

export const deleteStudyGroup = createServerFn({ method: "POST" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    await requireStaff();
    await db.studyGroup.delete({ where: { id } });
    return { ok: true };
  });

/**
 * Puts a student into a study group (removing them from any other group and
 * pair in the same subject first). Pass studyGroupId: null to just remove.
 */
export const setStudentStudyGroup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        subjectId: z.string().min(1),
        userId: z.string().min(1),
        studyGroupId: z.string().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    await db.pairMember.deleteMany({
      where: { userId: data.userId, pair: { studyGroup: { subjectId: data.subjectId } } },
    });
    await db.studyGroupMember.deleteMany({
      where: { userId: data.userId, studyGroup: { subjectId: data.subjectId } },
    });
    if (data.studyGroupId) {
      await db.studyGroupMember.create({
        data: { userId: data.userId, studyGroupId: data.studyGroupId },
      });
    }
    return { ok: true };
  });

export const addStudentToStudyGroup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().min(1), studyGroupId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    await db.studyGroupMember.upsert({
      where: {
        studyGroupId_userId: { studyGroupId: data.studyGroupId, userId: data.userId },
      },
      create: { studyGroupId: data.studyGroupId, userId: data.userId },
      update: {},
    });
    return { ok: true };
  });

export const removeStudentFromStudyGroup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().min(1), studyGroupId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    await db.pairMember.deleteMany({
      where: { userId: data.userId, pair: { studyGroupId: data.studyGroupId } },
    });
    await db.studyGroupMember.deleteMany({
      where: { studyGroupId: data.studyGroupId, userId: data.userId },
    });
    return { ok: true };
  });

export const createPair = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        studyGroupId: z.string().min(1),
        memberIds: z.array(z.string().min(1)).min(2).max(3),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    // Members must be in the study group and not already paired there.
    const members = await db.studyGroupMember.findMany({
      where: { studyGroupId: data.studyGroupId, userId: { in: data.memberIds } },
    });
    if (members.length !== data.memberIds.length) {
      throw new Error("Vybraní studenti nejsou všichni v této učební skupině.");
    }
    await db.pairMember.deleteMany({
      where: { userId: { in: data.memberIds }, pair: { studyGroupId: data.studyGroupId } },
    });
    const count = await db.pair.count({ where: { studyGroupId: data.studyGroupId } });
    const pair = await db.pair.create({
      data: {
        studyGroupId: data.studyGroupId,
        name: `Dvojice ${count + 1}`,
        members: { create: data.memberIds.map((userId) => ({ userId })) },
      },
    });
    return { id: pair.id };
  });

export const deletePair = createServerFn({ method: "POST" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    await requireStaff();
    await db.pair.delete({ where: { id } });
    return { ok: true };
  });

/** Randomly pairs up students of a study group who aren't in a pair yet. */
export const generatePairsInGroup = createServerFn({ method: "POST" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: studyGroupId }) => {
    await requireStaff();
    return generatePairsInGroupCore(studyGroupId);
  });

// --- users & enrollment ---

export const createUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        role: z.enum(ROLES),
        password: z.string().min(4),
        classId: z.string().nullable().default(null),
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
        classId: data.role === "STUDENT" ? data.classId : null,
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
    // Only actual students can be enrolled — silently drop teacher/admin ids.
    const students = await db.user.findMany({
      where: { id: { in: data.userIds }, role: "STUDENT" },
      select: { id: true },
    });
    for (const { id: userId } of students) {
      await db.enrollment.create({ data: { userId, subjectId: data.subjectId } }).catch(() => {}); // ignore duplicates
    }
    return { ok: true };
  });

export const updateUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        role: z.enum(ROLES),
        classId: z.string().nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const email = data.email.toLowerCase();
    const clash = await db.user.findFirst({ where: { email, NOT: { id: data.id } } });
    if (clash) throw new Error("Tento email už používá jiný uživatel.");
    await db.user.update({
      where: { id: data.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        role: data.role,
        classId: data.role === "STUDENT" ? data.classId : null,
      },
    });
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    const me = await requireStaff();
    if (me.id === id) throw new Error("Nemůžete smazat vlastní účet.");
    await db.user.delete({ where: { id } });
    return { ok: true };
  });

export const setUserPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), password: z.string().min(4) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    await db.user.update({
      where: { id: data.id },
      data: { passwordHash: hashPassword(data.password) },
    });
    return { ok: true };
  });

/** Assign a student to a class, or remove them (classId: null). */
export const setStudentClass = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().min(1), classId: z.string().nullable() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const user = await db.user.findUnique({ where: { id: data.userId } });
    if (!user || user.role !== "STUDENT") {
      throw new Error("Do třídy lze zařadit jen studenty.");
    }
    await db.user.update({ where: { id: data.userId }, data: { classId: data.classId } });
    return { ok: true };
  });

export const updateClass = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        schoolYear: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    await db.class.update({
      where: { id: data.id },
      data: { name: data.name, schoolYear: data.schoolYear },
    });
    return { ok: true };
  });

export const deleteClass = createServerFn({ method: "POST" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    await requireStaff();
    await db.class.delete({ where: { id } });
    return { ok: true };
  });

export const updateSubject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        description: z.string().default(""),
        themeStyle: z.enum(["loxone", "cad3d", "default"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    await db.subject.update({
      where: { id: data.id },
      data: { name: data.name, description: data.description, themeStyle: data.themeStyle },
    });
    return { ok: true };
  });

export const deleteSubject = createServerFn({ method: "POST" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    await requireStaff();
    await db.subject.delete({ where: { id } });
    return { ok: true };
  });

// --- assignment management edits/mazání ---

export const updateAssignment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        dueDate: z.string().optional(),
        targetType: z.enum(["INDIVIDUAL", "PAIR", "GROUP"]).optional(),
        isPublished: z.boolean().optional(),
        requiresConsent: z.boolean().optional(),
        consentText: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const updateData: {
      title?: string;
      description?: string;
      dueDate?: Date;
      targetType?: string;
      isPublished?: boolean;
      requiresConsent?: boolean;
      consentText?: string;
    } = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.targetType !== undefined) updateData.targetType = data.targetType;
    if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;
    if (data.requiresConsent !== undefined) updateData.requiresConsent = data.requiresConsent;
    if (data.consentText !== undefined) updateData.consentText = data.consentText;

    await db.assignment.update({
      where: { id: data.id },
      data: updateData,
    });
    return { ok: true };
  });

export const deleteAssignment = createServerFn({ method: "POST" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    await requireStaff();
    // Remove the whole assignment upload directory (files + empty unit folders).
    const dir = resolve(process.cwd(), UPLOAD_ROOT, id);
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch (err) {
      console.error("Nepodařilo se smazat složku odevzdání z disku:", err);
    }
    await db.assignment.delete({ where: { id } });
    return { ok: true };
  });

// --- materials management (SubjectFile upload/edit/delete) ---

export const uploadCourseFile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Očekávána data formuláře.");
    const pageId = data.get("pageId");
    const label = data.get("label");
    const category = data.get("category");
    const description = data.get("description");
    const file = data.get("file");
    if (typeof pageId !== "string" || !pageId) throw new Error("Chybí stránka.");
    if (typeof label !== "string" || !label) throw new Error("Chybí název souboru.");
    if (!(file instanceof File) || file.size === 0) throw new Error("Vyberte soubor.");
    assertFileSize(file);
    return {
      pageId,
      label,
      category: typeof category === "string" ? category : "material",
      description: typeof description === "string" ? description : "",
      file,
    };
  })
  .handler(async ({ data }) => {
    await requireStaff();

    const safeName = data.file.name.replace(/[^\w.-]+/g, "_").slice(-80) || "soubor";
    const relativeKey = `course_files/${data.pageId}/${Date.now().toString(36)}__${safeName}`;
    const absPath = resolve(process.cwd(), relativeKey);

    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, Buffer.from(await data.file.arrayBuffer()));

    const last = await db.subjectFile.findFirst({
      where: { pageId: data.pageId },
      orderBy: { order: "desc" },
    });

    await db.subjectFile.create({
      data: {
        pageId: data.pageId,
        label: data.label,
        fileName: data.file.name,
        fileKey: relativeKey,
        fileSize: data.file.size,
        mimeType: data.file.type || "application/octet-stream",
        category: data.category,
        description: data.description,
        order: (last?.order ?? -1) + 1,
      },
    });

    return { ok: true };
  });

export const deleteCourseFile = createServerFn({ method: "POST" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    await requireStaff();
    const file = await db.subjectFile.findUnique({ where: { id } });
    if (file) {
      const absPath = resolve(process.cwd(), file.fileKey);
      try {
        if (existsSync(absPath)) {
          unlinkSync(absPath);
        }
      } catch (err) {
        console.error("Nepodařilo se smazat soubor předmětu z disku:", err);
      }
      await db.subjectFile.delete({ where: { id } });
    }
    return { ok: true };
  });

export const updateCourseFile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        label: z.string().min(1),
        category: z.string().min(1),
        description: z.string().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    await db.subjectFile.update({
      where: { id: data.id },
      data: {
        label: data.label,
        category: data.category,
        description: data.description,
      },
    });
    return { ok: true };
  });

/** Toggle a material between draft and published (PRD §5A). Staff only. */
export const setCourseFilePublished = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), isPublished: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    await db.subjectFile.update({
      where: { id: data.id },
      data: { isPublished: data.isPublished },
    });
    return { ok: true };
  });

// --- student unenrollment ---

export const unenrollStudent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ subjectId: z.string().min(1), userId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();

    const groups = await db.studyGroup.findMany({ where: { subjectId: data.subjectId } });
    const groupIds = groups.map((g) => g.id);

    await db.pairMember.deleteMany({
      where: {
        userId: data.userId,
        pair: { studyGroupId: { in: groupIds } },
      },
    });

    await db.studyGroupMember.deleteMany({
      where: {
        userId: data.userId,
        studyGroupId: { in: groupIds },
      },
    });

    await db.enrollment.delete({
      where: { userId_subjectId: { userId: data.userId, subjectId: data.subjectId } },
    });

    return { ok: true };
  });
