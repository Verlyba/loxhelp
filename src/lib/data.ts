import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db";
import { asTheme, isStaff } from "@/lib/roles";
import type { SessionUser } from "@/lib/types";
import type {
  ActivityItem,
  AdminData,
  AnnouncementItem,
  AuditEntryView,
  AssignmentBrief,
  AssignmentDetail,
  AssignmentOverview,
  ClassesData,
  ClassOverviewData,
  StudentCardData,
  StudentCardRow,
  StudentProfileData,
  DashboardData,
  HubCourse,
  HubItem,
  OverviewCell,
  StaffSubjectPanel,
  StudentPanelData,
  StudentSubjectPanel,
  StudentTask,
  SubjectCard,
  SubjectDetail,
  SubjectGroupsData,
  TargetType,
  TaskStatus,
  UnitView,
  VersionItem,
} from "@/lib/types";

// --- shared helpers (server-only; run inside handlers) ---

async function requireUser(): Promise<SessionUser> {
  const { getSessionUser } = await import("@/lib/session");
  const user = await getSessionUser();
  if (!user) throw redirect({ to: "/auth" });
  return user;
}

async function requireStaffUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaff(user.role)) throw redirect({ to: "/" });
  return user;
}

function statusOf(submissionCount: number, dueDate: Date, extensionDate?: Date | null): TaskStatus {
  if (submissionCount > 0) return "submitted";
  const activeDueDate = extensionDate || dueDate;
  return activeDueDate.getTime() < Date.now() ? "overdue" : "pending";
}

const RANK: Record<TaskStatus, number> = { overdue: 0, pending: 1, submitted: 2 };

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

function asTarget(value: string): TargetType {
  return value === "PAIR" || value === "GROUP" ? value : "INDIVIDUAL";
}

type SubjectWithMeta = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  themeStyle: string;
  classId: string;
  class: { name: string; schoolYear: string };
  _count: { assignments: number; enrollments: number };
};

function toSubjectCard(s: SubjectWithMeta): SubjectCard {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    theme: asTheme(s.themeStyle),
    className: s.class.name,
    schoolYear: s.class.schoolYear,
    assignmentCount: s._count.assignments,
    studentCount: s._count.enrollments,
    classId: s.classId,
    imageUrl: s.imageUrl,
  };
}

const subjectCardArgs = {
  select: {
    id: true,
    name: true,
    slug: true,
    description: true,
    imageUrl: true,
    themeStyle: true,
    classId: true,
    class: { select: { name: true, schoolYear: true } },
    _count: { select: { assignments: true, enrollments: true } },
  },
} as const;

async function assertEnrolledOrStaff(user: SessionUser, subjectId: string): Promise<void> {
  if (isStaff(user.role)) return;
  const enrolled = await db.enrollment.findUnique({
    where: { userId_subjectId: { userId: user.id, subjectId } },
  });
  if (!enrolled) throw redirect({ to: "/subjects" });
}

/** The student's submission units, per subject: their pair and study group. */
async function myUnitsBySubject(userId: string) {
  const [pairs, groups] = await Promise.all([
    db.pairMember.findMany({
      where: { userId },
      include: {
        pair: {
          include: {
            studyGroup: { select: { subjectId: true, name: true } },
            members: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
    }),
    db.studyGroupMember.findMany({
      where: { userId },
      include: { studyGroup: { select: { id: true, subjectId: true, name: true } } },
    }),
  ]);

  const pairBySubject = new Map<
    string,
    { id: string; name: string; groupName: string; partnerNames: string[] }
  >();
  for (const pm of pairs) {
    pairBySubject.set(pm.pair.studyGroup.subjectId, {
      id: pm.pair.id,
      name: pm.pair.name,
      groupName: pm.pair.studyGroup.name,
      partnerNames: pm.pair.members
        .filter((m) => m.user.id !== userId)
        .map((m) => fullName(m.user)),
    });
  }
  const groupBySubject = new Map<string, { id: string; name: string }>();
  for (const gm of groups) {
    groupBySubject.set(gm.studyGroup.subjectId, {
      id: gm.studyGroup.id,
      name: gm.studyGroup.name,
    });
  }
  return { pairBySubject, groupBySubject };
}

function myUnitKeyFor(
  targetType: TargetType,
  userId: string,
  subjectId: string,
  units: Awaited<ReturnType<typeof myUnitsBySubject>>,
): string | null {
  if (targetType === "INDIVIDUAL") return `u:${userId}`;
  if (targetType === "PAIR") {
    const pair = units.pairBySubject.get(subjectId);
    return pair ? `p:${pair.id}` : null;
  }
  const group = units.groupBySubject.get(subjectId);
  return group ? `g:${group.id}` : null;
}

/**
 * The student's published assignments across subjects (or one subject), with
 * status computed from their unit's submissions and their grade.
 */
async function studentAssignmentInfos(userId: string, subjectId?: string) {
  const units = await myUnitsBySubject(userId);

  const assignments = await db.assignment.findMany({
    where: {
      isPublished: true,
      subject: subjectId
        ? { id: subjectId }
        : { enrollments: { some: { userId } }, class: { isArchived: false } },
    },
    orderBy: { dueDate: "asc" },
    include: { subject: { select: { id: true, name: true, slug: true } } },
  });

  const keys = new Set<string>();
  for (const a of assignments) {
    const k = myUnitKeyFor(asTarget(a.targetType), userId, a.subject.id, units);
    if (k) keys.add(k);
  }

  const [subs, grades] = await Promise.all([
    db.submission.findMany({
      where: { unitKey: { in: [...keys] }, assignmentId: { in: assignments.map((a) => a.id) } },
      orderBy: { version: "desc" },
      select: { assignmentId: true, unitKey: true, version: true },
    }),
    db.grade.findMany({
      where: { userId, assignmentId: { in: assignments.map((a) => a.id) } },
      select: { assignmentId: true, value: true, note: true, locked: true, extension: true },
    }),
  ]);

  const latestByAssignment = new Map<string, number>();
  const countByAssignment = new Map<string, number>();
  for (const s of subs) {
    if (!latestByAssignment.has(s.assignmentId)) latestByAssignment.set(s.assignmentId, s.version);
    countByAssignment.set(s.assignmentId, (countByAssignment.get(s.assignmentId) ?? 0) + 1);
  }
  const gradeByAssignment = new Map(grades.map((g) => [g.assignmentId, g]));

  return assignments.map((a) => {
    const targetType = asTarget(a.targetType);
    const unitKey = myUnitKeyFor(targetType, userId, a.subject.id, units);
    const count = unitKey ? (countByAssignment.get(a.id) ?? 0) : 0;
    const gradeObj = gradeByAssignment.get(a.id);
    return {
      assignment: a,
      targetType,
      unitKey,
      status: statusOf(count, a.dueDate, gradeObj?.extension),
      latestVersion: latestByAssignment.get(a.id) ?? null,
      grade: gradeObj?.value ?? null,
      feedback: gradeObj?.note ?? null,
      locked: gradeObj?.locked ?? false,
      extension: gradeObj?.extension?.toISOString() ?? null,
      units,
    };
  });
}

async function studentTasks(userId: string): Promise<StudentTask[]> {
  const infos = await studentAssignmentInfos(userId);
  const tasks = infos.map((i): StudentTask => {
    const pair = i.units.pairBySubject.get(i.assignment.subject.id);
    const group = i.units.groupBySubject.get(i.assignment.subject.id);
    const unitName =
      i.targetType === "PAIR"
        ? (pair?.name ?? "Bez dvojice")
        : i.targetType === "GROUP"
          ? (group?.name ?? "Bez skupiny")
          : "Samostatně";
    return {
      assignmentId: i.assignment.id,
      title: i.assignment.title,
      subjectName: i.assignment.subject.name,
      subjectSlug: i.assignment.subject.slug,
      dueAt: i.extension || i.assignment.dueDate.toISOString(),
      status: i.status,
      unitName,
      latestVersion: i.latestVersion,
    };
  });
  return tasks.sort(
    (a, b) => RANK[a.status] - RANK[b.status] || +new Date(a.dueAt) - +new Date(b.dueAt),
  );
}

type SubmissionForActivity = {
  version: number;
  fileName: string;
  createdAt: Date;
  uploadedBy: { firstName: string; lastName: string };
  user: { firstName: string; lastName: string } | null;
  pair: { name: string } | null;
  studyGroup: { name: string } | null;
  assignment: { id: string; title: string; subject: { slug: string } };
};

const activityInclude = {
  uploadedBy: { select: { firstName: true, lastName: true } },
  user: { select: { firstName: true, lastName: true } },
  pair: { select: { name: true } },
  studyGroup: { select: { name: true } },
  assignment: { select: { id: true, title: true, subject: { select: { slug: true } } } },
} as const;

function toActivity(s: SubmissionForActivity): ActivityItem {
  const unitName = s.pair?.name ?? s.studyGroup?.name ?? (s.user ? fullName(s.user) : "—");
  return {
    assignmentId: s.assignment.id,
    assignmentTitle: s.assignment.title,
    subjectSlug: s.assignment.subject.slug,
    unitName,
    version: s.version,
    fileName: s.fileName,
    uploadedByName: fullName(s.uploadedBy),
    uploadedAt: s.createdAt.toISOString(),
  };
}

async function studentRecent(userId: string, limit = 6): Promise<ActivityItem[]> {
  const units = await myUnitsBySubject(userId);
  const keys = [
    `u:${userId}`,
    ...[...units.pairBySubject.values()].map((p) => `p:${p.id}`),
    ...[...units.groupBySubject.values()].map((g) => `g:${g.id}`),
  ];
  const subs = await db.submission.findMany({
    where: { unitKey: { in: keys } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: activityInclude,
  });
  return subs.map(toActivity);
}

// --- dashboard ---

export const getDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => {
    const user = await requireUser();

    if (isStaff(user.role)) {
      const [subjects, activeClasses, assignments, unitGroups, recent] = await Promise.all([
        db.subject.findMany({ ...subjectCardArgs, orderBy: { name: "asc" } }),
        db.class.count({ where: { isArchived: false } }),
        db.assignment.count(),
        db.submission.groupBy({ by: ["assignmentId", "unitKey"] }),
        db.submission.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          include: activityInclude,
        }),
      ]);

      return {
        kind: "staff",
        stats: {
          subjects: subjects.length,
          activeClasses,
          assignments,
          openSubmissions: unitGroups.length,
        },
        subjects: subjects.map(toSubjectCard),
        recentUploads: recent.map(toActivity),
      };
    }

    const [subjects, tasks, recent, classNotifications] = await Promise.all([
      db.subject.findMany({
        ...subjectCardArgs,
        where: { enrollments: { some: { userId: user.id } } },
        orderBy: { name: "asc" },
      }),
      studentTasks(user.id),
      studentRecent(user.id),
      db.classNotification.findMany({
        where: { classId: user.classId || "" },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    return {
      kind: "student",
      subjects: subjects.map(toSubjectCard),
      tasks,
      recent,
      classNotifications: classNotifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        createdAt: n.createdAt.toISOString(),
        authorName: `${n.author.firstName} ${n.author.lastName}`,
      })),
    };
  },
);

// --- subjects ---

export const listSubjects = createServerFn({ method: "GET" }).handler(
  async (): Promise<SubjectCard[]> => {
    const user = await requireUser();
    const where = isStaff(user.role) ? {} : { enrollments: { some: { userId: user.id } } };
    const subjects = await db.subject.findMany({
      ...subjectCardArgs,
      where,
      orderBy: { name: "asc" },
    });
    return subjects.map(toSubjectCard);
  },
);

/** Units that exist for a subject per target type (for staff counts). */
async function subjectUnitTotals(subjectId: string) {
  const [students, pairs, groups] = await Promise.all([
    db.enrollment.count({ where: { subjectId } }),
    db.pair.count({ where: { studyGroup: { subjectId } } }),
    db.studyGroup.count({ where: { subjectId } }),
  ]);
  return { INDIVIDUAL: students, PAIR: pairs, GROUP: groups } as Record<TargetType, number>;
}

export const getSubject = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => z.string().parse(slug))
  .handler(async ({ data: slug }): Promise<SubjectDetail> => {
    const user = await requireUser();
    const staff = isStaff(user.role);

    const subject = await db.subject.findUnique({
      where: { slug },
      include: {
        class: { select: { name: true, schoolYear: true } },
        _count: { select: { assignments: true, enrollments: true } },
        pages: {
          orderBy: { order: "asc" },
          select: { id: true, title: true, slug: true, template: true },
        },
        assignments: { orderBy: { dueDate: "asc" } },
      },
    });
    if (!subject) throw redirect({ to: "/subjects" });
    await assertEnrolledOrStaff(user, subject.id);

    // Submitted-unit counts per assignment (one groupBy for the whole subject).
    const unitGroups = await db.submission.groupBy({
      by: ["assignmentId", "unitKey"],
      where: { assignment: { subjectId: subject.id } },
    });
    const submittedByAssignment = new Map<string, number>();
    for (const g of unitGroups) {
      submittedByAssignment.set(
        g.assignmentId,
        (submittedByAssignment.get(g.assignmentId) ?? 0) + 1,
      );
    }
    const totals = await subjectUnitTotals(subject.id);

    let studentInfos: Awaited<ReturnType<typeof studentAssignmentInfos>> | null = null;
    if (!staff) studentInfos = await studentAssignmentInfos(user.id, subject.id);
    const infoByAssignment = new Map((studentInfos ?? []).map((i) => [i.assignment.id, i]));

    const visible = staff ? subject.assignments : subject.assignments.filter((a) => a.isPublished);
    const assignments: AssignmentOverview[] = visible.map((a) => {
      const info = infoByAssignment.get(a.id);
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        dueAt: a.dueDate.toISOString(),
        targetType: asTarget(a.targetType),
        isPublished: a.isPublished,
        submittedUnits: submittedByAssignment.get(a.id) ?? 0,
        totalUnits: totals[asTarget(a.targetType)],
        myStatus: info?.status ?? null,
        myGrade: info?.grade ?? null,
      };
    });

    // --- static top panels ---
    let studentPanel: StudentSubjectPanel | null = null;
    let staffPanel: StaffSubjectPanel | null = null;

    if (staff) {
      staffPanel = {
        unpublished: subject.assignments
          .filter((a) => !a.isPublished)
          .map((a) => ({
            id: a.id,
            title: a.title,
            dueAt: a.dueDate.toISOString(),
            targetType: asTarget(a.targetType),
          })),
        published: subject.assignments
          .filter((a) => a.isPublished)
          .map((a) => ({
            id: a.id,
            title: a.title,
            dueAt: a.dueDate.toISOString(),
            submittedUnits: submittedByAssignment.get(a.id) ?? 0,
            totalUnits: totals[asTarget(a.targetType)],
          })),
      };
    } else if (studentInfos) {
      const brief = (i: (typeof studentInfos)[number]): AssignmentBrief => ({
        id: i.assignment.id,
        title: i.assignment.title,
        dueAt: i.assignment.dueDate.toISOString(),
        status: i.status,
        targetType: i.targetType,
      });
      const missing = studentInfos
        .filter((i) => i.status !== "submitted")
        .sort((a, b) => +a.assignment.dueDate - +b.assignment.dueDate);
      const grades = await db.grade.findMany({
        where: { userId: user.id, assignment: { subjectId: subject.id } },
        orderBy: { updatedAt: "desc" },
        take: 3,
        include: { assignment: { select: { title: true } } },
      });
      const pair = (await myUnitsBySubject(user.id)).pairBySubject.get(subject.id) ?? null;
      const group = (await myUnitsBySubject(user.id)).groupBySubject.get(subject.id) ?? null;
      studentPanel = {
        current: missing[0] ? brief(missing[0]) : null,
        missing: missing.map(brief),
        submittedCount: studentInfos.filter((i) => i.status === "submitted").length,
        publishedCount: studentInfos.length,
        recentGrades: grades
          .filter((g) => g.value != null)
          .map((g) => ({ assignmentTitle: g.assignment.title, value: g.value! })),
        myStudyGroup: group?.name ?? null,
        myPair: pair ? { name: pair.name, partnerNames: pair.partnerNames } : null,
      };
    }

    const [latestAnnouncement, announcementCount] = await Promise.all([
      db.announcement.findFirst({
        where: { subjectId: subject.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, createdAt: true },
      }),
      db.announcement.count({ where: { subjectId: subject.id } }),
    ]);

    return {
      ...toSubjectCard(subject),
      assignments,
      pages: subject.pages.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        template: p.template === "assignments" ? ("assignments" as const) : ("content" as const),
      })),
      studentPanel,
      staffPanel,
      latestAnnouncement: latestAnnouncement
        ? {
            id: latestAnnouncement.id,
            title: latestAnnouncement.title,
            createdAt: latestAnnouncement.createdAt.toISOString(),
          }
        : null,
      announcementCount,
    };
  });

/** All announcements of a course, newest first. */
export const getAnnouncements = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => z.string().parse(slug))
  .handler(async ({ data: slug }): Promise<AnnouncementItem[]> => {
    const user = await requireUser();
    const subject = await db.subject.findUnique({ where: { slug }, select: { id: true } });
    if (!subject) throw redirect({ to: "/subjects" });
    await assertEnrolledOrStaff(user, subject.id);

    const items = await db.announcement.findMany({
      where: { subjectId: subject.id },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    return items.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      authorName: fullName(a.author),
      createdAt: a.createdAt.toISOString(),
    }));
  });

/** One subject page (content + metadata). Enrollment is enforced like getSubject. */
export const getSubjectPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ subjectSlug: z.string(), pageSlug: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();

    const staff = isStaff(user.role);
    const page = await db.subjectPage.findFirst({
      where: { slug: data.pageSlug, subject: { slug: data.subjectSlug } },
      include: {
        subject: { select: { id: true, slug: true } },
        // Students see only published materials (PRD §5A); staff see drafts too.
        files: { where: staff ? {} : { isPublished: true }, orderBy: { order: "asc" } },
      },
    });
    if (!page) throw redirect({ to: "/subjects/$slug", params: { slug: data.subjectSlug } });
    await assertEnrolledOrStaff(user, page.subject.id);

    // Fetch assignments linked to this page
    const dbAssignments = await db.assignment.findMany({
      where: { pageId: page.id },
      orderBy: { dueDate: "asc" },
    });

    const unitGroups = await db.submission.groupBy({
      by: ["assignmentId", "unitKey"],
      where: { assignment: { pageId: page.id } },
    });
    const submittedByAssignment = new Map<string, number>();
    for (const g of unitGroups) {
      submittedByAssignment.set(
        g.assignmentId,
        (submittedByAssignment.get(g.assignmentId) ?? 0) + 1,
      );
    }
    const totals = await subjectUnitTotals(page.subject.id);

    let studentInfos: Awaited<ReturnType<typeof studentAssignmentInfos>> | null = null;
    if (!staff) studentInfos = await studentAssignmentInfos(user.id, page.subject.id);
    const infoByAssignment = new Map((studentInfos ?? []).map((i) => [i.assignment.id, i]));

    const visible = staff ? dbAssignments : dbAssignments.filter((a) => a.isPublished);
    const assignments: AssignmentOverview[] = visible.map((a) => {
      const info = infoByAssignment.get(a.id);
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        dueAt: a.dueDate.toISOString(),
        targetType: asTarget(a.targetType),
        isPublished: a.isPublished,
        submittedUnits: submittedByAssignment.get(a.id) ?? 0,
        totalUnits: totals[asTarget(a.targetType)],
        myStatus: info?.status ?? null,
        myGrade: info?.grade ?? null,
        pageId: a.pageId,
      };
    });

    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      template: page.template === "assignments" ? ("assignments" as const) : ("content" as const),
      content: page.content,
      showAssignments: page.showAssignments,
      assignments: page.showAssignments || staff ? assignments : [],
      updatedAt: page.updatedAt.toISOString(),
      files: page.files.map((f) => ({
        id: f.id,
        label: f.label,
        fileName: f.fileName,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        category: f.category,
        description: f.description,
        isPublished: f.isPublished,
      })),
    };
  });

// --- assignment detail ---

type SubmissionRow = {
  id: string;
  version: number;
  unitKey: string;
  fileName: string;
  fileSize: number;
  note: string | null;
  createdAt: Date;
  uploadedById: string;
  uploadedBy: { firstName: string; lastName: string };
};

function toVersion(s: SubmissionRow): VersionItem {
  return {
    id: s.id,
    version: s.version,
    fileName: s.fileName,
    fileSize: s.fileSize,
    uploadedById: s.uploadedById,
    uploadedByName: fullName(s.uploadedBy),
    uploadedAt: s.createdAt.toISOString(),
    note: s.note,
  };
}

export const getAssignment = createServerFn({ method: "GET" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }): Promise<AssignmentDetail> => {
    const user = await requireUser();
    const staff = isStaff(user.role);

    const assignment = await db.assignment.findUnique({
      where: { id },
      include: { subject: { select: { name: true, slug: true, themeStyle: true, id: true } } },
    });
    if (!assignment) throw redirect({ to: "/subjects" });
    await assertEnrolledOrStaff(user, assignment.subject.id);
    if (!staff && !assignment.isPublished) {
      throw redirect({ to: "/subjects/$slug", params: { slug: assignment.subject.slug } });
    }

    const targetType = asTarget(assignment.targetType);
    const subjectId = assignment.subject.id;

    const [subs, grades, myConsent, consents] = await Promise.all([
      db.submission.findMany({
        where: { assignmentId: id },
        orderBy: { version: "desc" },
        include: { uploadedBy: { select: { firstName: true, lastName: true } } },
      }),
      db.grade.findMany({ where: { assignmentId: id } }),
      staff
        ? null
        : db.assignmentConsent.findUnique({
            where: { assignmentId_userId: { assignmentId: id, userId: user.id } },
          }),
      staff
        ? db.assignmentConsent.findMany({
            where: { assignmentId: id },
            include: { user: { select: { firstName: true, lastName: true } } },
            orderBy: { acceptedAt: "desc" },
          })
        : [],
    ]);

    const consentsMapped = staff
      ? consents.map((c) => ({
          userId: c.userId,
          userName: fullName(c.user),
          acceptedText: c.acceptedText,
          variant: c.variant,
          acceptedAt: c.acceptedAt.toISOString(),
        }))
      : undefined;
    const subsByUnit = new Map<string, SubmissionRow[]>();
    for (const s of subs) {
      const list = subsByUnit.get(s.unitKey) ?? [];
      list.push(s);
      subsByUnit.set(s.unitKey, list);
    }
    const gradeByUser = new Map(grades.map((g) => [g.userId, g.value]));

    const mkUnit = (
      key: string,
      name: string,
      studyGroupName: string | null,
      members: { id: string; name: string }[],
    ): UnitView => {
      const versions = (subsByUnit.get(key) ?? []).map(toVersion);
      const first = versions[versions.length - 1];
      const memberGrades = members
        .map((m) => grades.find((g) => g.userId === m.id))
        .filter((g): g is NonNullable<typeof g> => g != null);
      const grade = memberGrades.find((g) => g.value != null)?.value ?? null;
      const feedback = memberGrades.find((g) => g.note != null)?.note ?? null;
      const locked = memberGrades.some((g) => g.locked === true);
      const extension =
        memberGrades.find((g) => g.extension != null)?.extension?.toISOString() ?? null;
      return {
        key,
        name,
        studyGroupName,
        members,
        versions,
        submittedAt: first ? first.uploadedAt : null,
        grade,
        feedback,
        locked,
        extension,
      };
    };

    let units: UnitView[] = [];
    let myUnitKey: string | null = null;

    if (targetType === "INDIVIDUAL") {
      const enrollments = await db.enrollment.findMany({
        where: { subjectId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              studyGroupMembers: {
                where: { studyGroup: { subjectId } },
                select: { studyGroup: { select: { name: true } } },
              },
            },
          },
        },
      });
      const all = enrollments
        .map((e) =>
          mkUnit(
            `u:${e.user.id}`,
            fullName(e.user),
            e.user.studyGroupMembers[0]?.studyGroup.name ?? null,
            [{ id: e.user.id, name: fullName(e.user) }],
          ),
        )
        .sort(
          (a, b) =>
            (a.studyGroupName ?? "").localeCompare(b.studyGroupName ?? "") ||
            a.name.localeCompare(b.name),
        );
      myUnitKey = staff ? null : `u:${user.id}`;
      units = staff ? all : all.filter((u) => u.key === myUnitKey);
    } else if (targetType === "PAIR") {
      const pairs = await db.pair.findMany({
        where: { studyGroup: { subjectId } },
        include: {
          studyGroup: { select: { name: true } },
          members: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        },
        orderBy: { name: "asc" },
      });
      const all = pairs
        .map((p) =>
          mkUnit(
            `p:${p.id}`,
            p.name,
            p.studyGroup.name,
            p.members.map((m) => ({ id: m.user.id, name: fullName(m.user) })),
          ),
        )
        .sort(
          (a, b) =>
            (a.studyGroupName ?? "").localeCompare(b.studyGroupName ?? "") ||
            a.name.localeCompare(b.name),
        );
      const mine = all.find((u) => u.members.some((m) => m.id === user.id));
      myUnitKey = staff ? null : (mine?.key ?? null);
      units = staff ? all : mine ? [mine] : [];
    } else {
      const groups = await db.studyGroup.findMany({
        where: { subjectId },
        include: {
          members: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        },
        orderBy: { name: "asc" },
      });
      const all = groups.map((g) =>
        mkUnit(
          `g:${g.id}`,
          g.name,
          g.name,
          g.members.map((m) => ({ id: m.user.id, name: fullName(m.user) })),
        ),
      );
      const mine = all.find((u) => u.members.some((m) => m.id === user.id));
      myUnitKey = staff ? null : (mine?.key ?? null);
      units = staff ? all : mine ? [mine] : [];
    }

    return {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      dueAt: assignment.dueDate.toISOString(),
      subjectName: assignment.subject.name,
      subjectSlug: assignment.subject.slug,
      theme: asTheme(assignment.subject.themeStyle),
      targetType,
      isPublished: assignment.isPublished,
      canUpload:
        !staff &&
        !!myUnitKey &&
        assignment.isPublished &&
        !units.find((u) => u.key === myUnitKey)?.locked,
      myUnitKey,
      units,
      requiresConsent: assignment.requiresConsent,
      consentText: assignment.consentText,
      myConsent: myConsent
        ? {
            acceptedText: myConsent.acceptedText,
            variant: myConsent.variant,
            acceptedAt: myConsent.acceptedAt.toISOString(),
          }
        : null,
      consents: consentsMapped,
      pageId: assignment.pageId,
    };
  });

// --- student right panel ---

export const getStudentPanel = createServerFn({ method: "GET" }).handler(
  async (): Promise<StudentPanelData> => {
    const user = await requireUser();
    if (isStaff(user.role)) return { tasks: [], recent: [] };
    const [tasks, recent] = await Promise.all([studentTasks(user.id), studentRecent(user.id)]);
    return { tasks, recent };
  },
);

// --- odevzdávárna (submission hub) ---

export const getSubmissionHub = createServerFn({ method: "GET" }).handler(
  async (): Promise<HubCourse[]> => {
    const user = await requireUser();
    if (isStaff(user.role)) return [];

    const [subjects, infos] = await Promise.all([
      db.subject.findMany({
        where: { enrollments: { some: { userId: user.id } }, class: { isArchived: false } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, themeStyle: true },
      }),
      studentAssignmentInfos(user.id),
    ]);

    return subjects.map((s): HubCourse => {
      const items = infos
        .filter((i) => i.assignment.subject.id === s.id)
        .map(
          (i): HubItem => ({
            assignmentId: i.assignment.id,
            title: i.assignment.title,
            dueAt: i.assignment.dueDate.toISOString(),
            status: i.status,
            targetType: i.targetType,
            grade: i.grade,
            subjectSlug: s.slug,
          }),
        );
      return {
        subjectId: s.id,
        name: s.name,
        slug: s.slug,
        theme: asTheme(s.themeStyle),
        missing: items.filter((i) => i.status !== "submitted"),
        done: items.filter((i) => i.status === "submitted"),
      };
    });
  },
);

// --- study groups & pairs management (staff) ---

export const getSubjectGroups = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => z.string().parse(slug))
  .handler(async ({ data: slug }): Promise<SubjectGroupsData> => {
    await requireStaffUser();

    const subject = await db.subject.findUnique({
      where: { slug },
      include: {
        class: { include: { students: { where: { role: "STUDENT" } } } },
        enrollments: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        studyGroups: {
          orderBy: { name: "asc" },
          include: {
            members: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
            pairs: {
              orderBy: { name: "asc" },
              include: {
                members: {
                  include: { user: { select: { id: true, firstName: true, lastName: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!subject) throw redirect({ to: "/subjects" });

    const inAnyGroup = new Set(subject.studyGroups.flatMap((g) => g.members.map((m) => m.userId)));
    const enrolledIds = new Set(subject.enrollments.map((e) => e.userId));

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      studyGroups: subject.studyGroups.map((g) => {
        const pairNameByUser = new Map<string, string>();
        for (const p of g.pairs) for (const m of p.members) pairNameByUser.set(m.userId, p.name);
        return {
          id: g.id,
          name: g.name,
          members: g.members.map((m) => ({
            id: m.user.id,
            name: fullName(m.user),
            pairName: pairNameByUser.get(m.user.id) ?? null,
          })),
          pairs: g.pairs.map((p) => ({
            id: p.id,
            name: p.name,
            members: p.members.map((m) => ({ id: m.user.id, name: fullName(m.user) })),
          })),
        };
      }),
      unassigned: subject.enrollments
        .filter((e) => !inAnyGroup.has(e.userId))
        .map((e) => ({ id: e.user.id, name: fullName(e.user) })),
      notEnrolled: subject.class.students
        .filter((s) => !enrolledIds.has(s.id))
        .map((s) => ({ id: s.id, name: fullName(s) })),
    };
  });

// --- class overview per course (staff) ---

export const getClassOverview = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => z.string().parse(slug))
  .handler(async ({ data: slug }): Promise<ClassOverviewData> => {
    await requireStaffUser();

    const subject = await db.subject.findUnique({
      where: { slug },
      include: {
        assignments: { where: { isPublished: true }, orderBy: { dueDate: "asc" } },
        enrollments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                studyGroupMembers: {
                  select: {
                    studyGroupId: true,
                    studyGroup: { select: { name: true, subjectId: true } },
                  },
                },
                pairMembers: {
                  select: {
                    pairId: true,
                    pair: {
                      select: { name: true, studyGroup: { select: { subjectId: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!subject) throw redirect({ to: "/subjects" });

    const [subs, grades, allPairs, allStudyGroups] = await Promise.all([
      db.submission.findMany({
        where: { assignment: { subjectId: subject.id } },
        select: {
          id: true,
          assignmentId: true,
          unitKey: true,
          uploadedById: true,
          createdAt: true,
          version: true,
          fileName: true,
          fileSize: true,
          note: true,
          uploadedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      db.grade.findMany({
        where: { assignment: { subjectId: subject.id } },
        select: {
          assignmentId: true,
          userId: true,
          value: true,
          note: true,
          locked: true,
          extension: true,
        },
      }),
      db.pair.findMany({
        where: { studyGroup: { subjectId: subject.id } },
        include: {
          members: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        },
      }),
      db.studyGroup.findMany({
        where: { subjectId: subject.id },
        include: {
          members: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        },
      }),
    ]);

    // versions per assignment+unitKey; first submission time; per-user upload counts
    const unitStats = new Map<string, { count: number; first: Date }>();
    const userUploads = new Map<string, number>(); // `${assignmentId}|${userId}`
    const versionsMap = new Map<string, VersionItem[]>();

    for (const s of subs) {
      const k = `${s.assignmentId}|${s.unitKey}`;
      const stat = unitStats.get(k);
      if (stat) stat.count += 1;
      else unitStats.set(k, { count: 1, first: s.createdAt });
      const uk = `${s.assignmentId}|${s.uploadedById}`;
      userUploads.set(uk, (userUploads.get(uk) ?? 0) + 1);

      const list = versionsMap.get(k) ?? [];
      list.unshift({
        id: s.id,
        version: s.version,
        fileName: s.fileName,
        fileSize: s.fileSize,
        uploadedById: s.uploadedById,
        uploadedByName: `${s.uploadedBy.firstName} ${s.uploadedBy.lastName}`,
        uploadedAt: s.createdAt.toISOString(),
        note: s.note,
      });
      versionsMap.set(k, list);
    }
    const gradeMap = new Map(grades.map((g) => [`${g.assignmentId}|${g.userId}`, g]));

    const rows = subject.enrollments.map((e) => {
      const u = e.user;
      const sg = u.studyGroupMembers.find((m) => m.studyGroup.subjectId === subject.id);
      const pm = u.pairMembers.find((m) => m.pair.studyGroup.subjectId === subject.id);

      const cells: Record<string, OverviewCell> = {};
      for (const a of subject.assignments) {
        const target = asTarget(a.targetType);
        const unitKey =
          target === "INDIVIDUAL"
            ? `u:${u.id}`
            : target === "PAIR"
              ? pm
                ? `p:${pm.pairId}`
                : null
              : sg
                ? `g:${sg.studyGroupId}`
                : null;

        const cellMembers =
          target === "INDIVIDUAL"
            ? [{ id: u.id, name: fullName(u) }]
            : target === "PAIR"
              ? pm
                ? (allPairs
                    .find((p) => p.id === pm.pairId)
                    ?.members.map((m) => ({ id: m.user.id, name: fullName(m.user) })) ?? [])
                : []
              : sg
                ? (allStudyGroups
                    .find((g) => g.id === sg.studyGroupId)
                    ?.members.map((m) => ({ id: m.user.id, name: fullName(m.user) })) ?? [])
                : [];

        const memberUserIds = cellMembers.map((m) => m.id);
        const activeGrades = memberUserIds
          .map((uid) => gradeMap.get(`${a.id}|${uid}`))
          .filter((g): g is NonNullable<typeof g> => g != null);
        const gradeVal = activeGrades.find((g) => g.value != null)?.value ?? null;
        const feedback = activeGrades.find((g) => g.note != null)?.note ?? null;
        const locked = activeGrades.some((g) => g.locked === true);
        const extension =
          activeGrades.find((g) => g.extension != null)?.extension?.toISOString() ?? null;

        const stat = unitKey ? unitStats.get(`${a.id}|${unitKey}`) : undefined;
        cells[a.id] = {
          status: unitKey
            ? statusOf(stat?.count ?? 0, a.dueDate, extension ? new Date(extension) : null)
            : "none",
          submittedAt: stat ? stat.first.toISOString() : null,
          versions: stat?.count ?? 0,
          myUploads: userUploads.get(`${a.id}|${u.id}`) ?? 0,
          grade: gradeVal,
          feedback,
          locked,
          extension,
          versionsList: unitKey ? (versionsMap.get(`${a.id}|${unitKey}`) ?? []) : [],
          members: cellMembers,
        };
      }

      return {
        studentId: u.id,
        name: fullName(u),
        studyGroup: sg?.studyGroup.name ?? null,
        pair: pm?.pair.name ?? null,
        cells,
      };
    });

    rows.sort(
      (a, b) =>
        (a.studyGroup ?? "").localeCompare(b.studyGroup ?? "") || a.name.localeCompare(b.name),
    );

    return {
      subjectName: subject.name,
      assignments: subject.assignments.map((a) => ({
        id: a.id,
        title: a.title,
        dueAt: a.dueDate.toISOString(),
        targetType: asTarget(a.targetType),
      })),
      rows,
    };
  });

// --- audit trail viewer (staff) — PRD §5C ---

export const getGradeAudit = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({ assignmentId: z.string().min(1), userIds: z.array(z.string().min(1)).min(1) })
      .parse(d),
  )
  .handler(async ({ data }): Promise<AuditEntryView[]> => {
    await requireStaffUser();
    const ids = data.userIds.map((u) => `${data.assignmentId}:${u}`);
    const logs = await db.auditLog.findMany({
      where: { entityType: "Grade", entityId: { in: ids } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { actor: { select: { firstName: true, lastName: true } } },
    });
    return logs.map((l) => ({
      id: l.id,
      action: l.action,
      actorName: fullName(l.actor),
      targetName: l.targetName,
      oldValue: l.oldValue,
      newValue: l.newValue,
      createdAt: l.createdAt.toISOString(),
    }));
  });

// --- globální karta žáka (staff) — identita + kurzy + souhrn napříč kurzy ---

export const getStudentProfile = createServerFn({ method: "GET" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }): Promise<StudentProfileData> => {
    await requireStaffUser();

    const student = await db.user.findUnique({
      where: { id },
      include: {
        class: { select: { name: true } },
        enrollments: {
          include: {
            subject: { select: { id: true, name: true, slug: true, themeStyle: true } },
          },
        },
        studyGroupMembers: {
          include: { studyGroup: { select: { subjectId: true, name: true } } },
        },
        pairMembers: {
          include: {
            pair: { select: { name: true, studyGroup: { select: { subjectId: true } } } },
          },
        },
      },
    });
    if (!student || student.role !== "STUDENT") throw redirect({ to: "/admin" });

    const groupBySubject = new Map(
      student.studyGroupMembers.map((m) => [m.studyGroup.subjectId, m.studyGroup.name]),
    );
    const pairBySubject = new Map(
      student.pairMembers.map((m) => [m.pair.studyGroup.subjectId, m.pair.name]),
    );

    const [totalUploads, grades, classes] = await Promise.all([
      db.submission.count({ where: { uploadedById: id } }),
      db.grade.findMany({ where: { userId: id, value: { not: null } }, select: { value: true } }),
      db.class.findMany({
        orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
        select: { id: true, name: true, schoolYear: true, isArchived: true },
      }),
    ]);

    const numeric = grades
      .map((g) => parseFloat((g.value ?? "").replace(",", ".").replace("-", ".5")))
      .filter((n) => !Number.isNaN(n));

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        name: fullName(student),
        email: student.email,
        classId: student.classId,
        className: student.class?.name ?? null,
        createdAt: student.createdAt.toISOString(),
      },
      subjects: student.enrollments.map((e) => ({
        id: e.subject.id,
        name: e.subject.name,
        slug: e.subject.slug,
        theme: asTheme(e.subject.themeStyle),
        studyGroup: groupBySubject.get(e.subject.id) ?? null,
        pair: pairBySubject.get(e.subject.id) ?? null,
      })),
      stats: {
        totalUploads,
        gradedCount: grades.length,
        avgGrade:
          numeric.length > 0
            ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1).replace(".", ",")
            : null,
      },
      classes,
    };
  });

// --- karta žáka (staff) — Moodle-style per-course user report ---

export const getStudentCard = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1), studentId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }): Promise<StudentCardData> => {
    await requireStaffUser();

    const subject = await db.subject.findUnique({
      where: { slug: data.slug },
      include: { assignments: { where: { isPublished: true }, orderBy: { dueDate: "asc" } } },
    });
    if (!subject) throw redirect({ to: "/subjects" });

    const student = await db.user.findUnique({
      where: { id: data.studentId },
      include: {
        class: { select: { name: true } },
        studyGroupMembers: {
          where: { studyGroup: { subjectId: subject.id } },
          include: { studyGroup: { select: { id: true, name: true } } },
        },
        pairMembers: {
          where: { pair: { studyGroup: { subjectId: subject.id } } },
          include: {
            pair: {
              include: {
                members: {
                  include: { user: { select: { id: true, firstName: true, lastName: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!student) throw redirect({ to: "/subjects/$slug/overview", params: { slug: data.slug } });

    const sg = student.studyGroupMembers[0]?.studyGroup ?? null;
    const pm = student.pairMembers[0]?.pair ?? null;

    // The student's unit keys in this course.
    const unitKeys = [`u:${student.id}`];
    if (pm) unitKeys.push(`p:${pm.id}`);
    if (sg) unitKeys.push(`g:${sg.id}`);

    const [subs, grades, classes] = await Promise.all([
      db.submission.findMany({
        where: {
          assignment: { subjectId: subject.id },
          OR: [{ unitKey: { in: unitKeys } }, { uploadedById: student.id }],
        },
        orderBy: { createdAt: "asc" },
        select: {
          assignmentId: true,
          unitKey: true,
          uploadedById: true,
          createdAt: true,
          fileName: true,
          assignment: { select: { title: true } },
        },
      }),
      db.grade.findMany({
        where: { userId: student.id, assignment: { subjectId: subject.id } },
      }),
      db.class.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const gradeByAssignment = new Map(grades.map((g) => [g.assignmentId, g]));

    const rows: StudentCardRow[] = subject.assignments.map((a) => {
      const target = asTarget(a.targetType);
      const unitKey =
        target === "INDIVIDUAL"
          ? `u:${student.id}`
          : target === "PAIR"
            ? pm
              ? `p:${pm.id}`
              : null
            : sg
              ? `g:${sg.id}`
              : null;
      const unitSubs = unitKey
        ? subs.filter((s) => s.assignmentId === a.id && s.unitKey === unitKey)
        : [];
      const first = unitSubs[0] ?? null;
      const grade = gradeByAssignment.get(a.id);
      const deadline = grade?.extension ?? a.dueDate;

      return {
        assignmentId: a.id,
        title: a.title,
        dueAt: a.dueDate.toISOString(),
        targetType: target,
        status: unitKey ? statusOf(unitSubs.length, a.dueDate) : "none",
        submittedAt: first ? first.createdAt.toISOString() : null,
        versions: unitSubs.length,
        myUploads: unitSubs.filter((s) => s.uploadedById === student.id).length,
        onTime: first ? first.createdAt.getTime() <= deadline.getTime() : null,
        grade: grade?.value ?? null,
        feedback: grade?.note ?? null,
      };
    });

    // Summary stats.
    const submittedRows = rows.filter((r) => r.status === "submitted");
    const numericGrades = rows
      .map((r) => r.grade)
      .filter((g): g is string => g !== null)
      .map((g) => parseFloat(g.replace(",", ".").replace("-", ".5")))
      .filter((n) => !Number.isNaN(n));
    const onTimeVals = rows.map((r) => r.onTime).filter((v): v is boolean => v !== null);

    return {
      student: {
        id: student.id,
        name: fullName(student),
        email: student.email,
        className: student.class?.name ?? null,
        firstName: student.firstName,
        lastName: student.lastName,
        role: student.role,
        classId: student.classId,
      },
      subjectName: subject.name,
      subjectSlug: subject.slug,
      studyGroup: sg?.name ?? null,
      pair: pm
        ? {
            name: pm.name,
            partnerNames: pm.members
              .filter((m) => m.user.id !== student.id)
              .map((m) => fullName(m.user)),
          }
        : null,
      stats: {
        submitted: submittedRows.length,
        total: rows.filter((r) => r.status !== "none").length,
        avgGrade:
          numericGrades.length > 0
            ? (numericGrades.reduce((a, b) => a + b, 0) / numericGrades.length)
                .toFixed(1)
                .replace(".", ",")
            : null,
        onTimeRate:
          onTimeVals.length > 0
            ? Math.round((onTimeVals.filter(Boolean).length / onTimeVals.length) * 100)
            : null,
        totalUploads: subs.filter((s) => s.uploadedById === student.id).length,
      },
      rows,
      recentUploads: subs
        .filter((s) => s.uploadedById === student.id)
        .slice(-6)
        .reverse()
        .map((s) => ({
          fileName: s.fileName,
          assignmentTitle: s.assignment.title,
          uploadedAt: s.createdAt.toISOString(),
        })),
      classes: classes.map((c) => ({ id: c.id, name: c.name })),
    };
  });

// --- classes (staff) ---

export const getClasses = createServerFn({ method: "GET" }).handler(
  async (): Promise<ClassesData> => {
    await requireStaffUser();

    const [classes, withoutClass, allSubjects] = await Promise.all([
      db.class.findMany({
        orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
        include: {
          subjects: { select: { id: true, name: true, slug: true, themeStyle: true } },
          students: {
            where: { role: "STUDENT" },
            orderBy: { lastName: "asc" },
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          notifications: {
            orderBy: { createdAt: "desc" },
            include: { author: { select: { firstName: true, lastName: true } } },
          },
        },
      }),
      db.user.findMany({
        where: { role: "STUDENT", classId: null },
        orderBy: { lastName: "asc" },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      db.subject.findMany({
        ...subjectCardArgs,
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        schoolYear: c.schoolYear,
        isArchived: c.isArchived,
        studentCount: c.students.length,
        subjects: c.subjects.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          theme: asTheme(s.themeStyle),
        })),
        students: c.students.map((s) => ({ id: s.id, name: fullName(s), email: s.email })),
        notifications: c.notifications.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          createdAt: n.createdAt.toISOString(),
          authorName: `${n.author.firstName} ${n.author.lastName}`,
        })),
      })),
      withoutClass: withoutClass.map((s) => ({ id: s.id, name: fullName(s), email: s.email })),
      allSubjects: allSubjects.map(toSubjectCard),
    };
  },
);

// --- admin overview (staff) ---

export const getAdminData = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminData> => {
    await requireStaffUser();

    const [users, classes, subjects, auditLogs] = await Promise.all([
      db.user.findMany({
        orderBy: [{ role: "asc" }, { lastName: "asc" }],
        include: { class: { select: { name: true } } },
      }),
      db.class.findMany({
        orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
        include: { _count: { select: { subjects: true, students: true } } },
      }),
      db.subject.findMany({ ...subjectCardArgs, orderBy: { name: "asc" } }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        name: fullName(u),
        email: u.email,
        role: u.role === "ADMIN" || u.role === "TEACHER" ? u.role : ("STUDENT" as const),
        classId: u.classId,
        className: u.class?.name ?? null,
      })),
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        schoolYear: c.schoolYear,
        isArchived: c.isArchived,
        subjectCount: c._count.subjects,
        studentCount: c._count.students,
      })),
      subjects: subjects.map(toSubjectCard),
      auditLogs: auditLogs.map((l) => ({
        id: l.id,
        action: l.action,
        actorName: `${l.actor.firstName} ${l.actor.lastName}`,
        targetName: l.targetName,
        oldValue: l.oldValue,
        newValue: l.newValue,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  },
);

export const getSubjectsManagementData = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const staff = isStaff(user.role);

  const where = staff ? {} : { enrollments: { some: { userId: user.id } } };
  const subjects = await db.subject.findMany({
    include: {
      class: { select: { name: true, schoolYear: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { assignments: true, enrollments: true } },
    },
    where,
    orderBy: { name: "asc" },
  });

  let classes: { id: string; name: string; schoolYear: string }[] = [];
  let teachers: { id: string; firstName: string; lastName: string }[] = [];

  if (staff) {
    classes = await db.class.findMany({
      where: { isArchived: false },
      orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
      select: { id: true, name: true, schoolYear: true },
    });

    teachers = await db.user.findMany({
      where: { role: { in: ["TEACHER", "ADMIN"] } },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    });
  }

  return {
    subjects: subjects.map((s) => ({
      ...toSubjectCard(s),
      teacherId: s.teacherId,
      teacherName: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : null,
      classId: s.classId,
    })),
    classes,
    teachers,
  };
});
