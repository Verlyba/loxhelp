import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { asTheme, isStaff } from "@/lib/roles";
import type { SessionUser } from "@/lib/types";
import type {
  ActivityItem,
  AdminData,
  AssignmentDetail,
  AssignmentOverview,
  ClassWithSubjects,
  DashboardData,
  GroupView,
  StudentPanelData,
  StudentTask,
  SubjectCard,
  SubjectDetail,
  TaskStatus,
  VersionItem,
} from "@/lib/types";

// --- shared helpers (server-only; run inside handlers) ---

async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw redirect({ to: "/auth" });
  return user;
}

function statusOf(submissionCount: number, dueDate: Date): TaskStatus {
  if (submissionCount > 0) return "submitted";
  return dueDate.getTime() < Date.now() ? "overdue" : "pending";
}

const RANK: Record<TaskStatus, number> = { overdue: 0, pending: 1, submitted: 2 };

type SubjectWithMeta = {
  id: string;
  name: string;
  slug: string;
  description: string;
  themeStyle: string;
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
  };
}

const subjectCardArgs = {
  include: {
    class: { select: { name: true, schoolYear: true } },
    _count: { select: { assignments: true, enrollments: true } },
  },
} as const;

type SubmissionWithContext = {
  version: number;
  fileName: string;
  createdAt: Date;
  uploadedBy: { firstName: string; lastName: string };
  group: {
    name: string;
    assignment: { id: string; title: string; subject: { slug: string } };
  };
};

function toActivity(s: SubmissionWithContext): ActivityItem {
  return {
    assignmentId: s.group.assignment.id,
    assignmentTitle: s.group.assignment.title,
    subjectSlug: s.group.assignment.subject.slug,
    groupName: s.group.name,
    version: s.version,
    fileName: s.fileName,
    uploadedByName: `${s.uploadedBy.firstName} ${s.uploadedBy.lastName}`,
    uploadedAt: s.createdAt.toISOString(),
  };
}

async function studentTasks(userId: string): Promise<StudentTask[]> {
  const memberships = await db.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          submissions: { orderBy: { version: "desc" } },
          assignment: { include: { subject: { select: { name: true, slug: true } } } },
        },
      },
    },
  });

  const tasks = memberships.map(({ group }): StudentTask => {
    const status = statusOf(group.submissions.length, group.assignment.dueDate);
    return {
      assignmentId: group.assignment.id,
      title: group.assignment.title,
      subjectName: group.assignment.subject.name,
      subjectSlug: group.assignment.subject.slug,
      dueAt: group.assignment.dueDate.toISOString(),
      status,
      groupName: group.name,
      latestVersion: group.submissions[0]?.version ?? null,
    };
  });

  return tasks.sort(
    (a, b) => RANK[a.status] - RANK[b.status] || +new Date(a.dueAt) - +new Date(b.dueAt),
  );
}

async function studentRecent(userId: string, limit = 6): Promise<ActivityItem[]> {
  const subs = await db.submission.findMany({
    where: { group: { members: { some: { userId } } } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      uploadedBy: { select: { firstName: true, lastName: true } },
      group: {
        select: {
          name: true,
          assignment: { select: { id: true, title: true, subject: { select: { slug: true } } } },
        },
      },
    },
  });
  return subs.map(toActivity);
}

// --- dashboard ---

export const getDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => {
    const user = await requireUser();

    if (isStaff(user.role)) {
      const [subjects, activeClasses, assignments, groupsWithSubs, recent] = await Promise.all([
        db.subject.findMany({ ...subjectCardArgs, orderBy: { name: "asc" } }),
        db.class.count({ where: { isArchived: false } }),
        db.assignment.count(),
        db.group.count({ where: { submissions: { some: {} } } }),
        db.submission.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          include: {
            uploadedBy: { select: { firstName: true, lastName: true } },
            group: {
              select: {
                name: true,
                assignment: {
                  select: { id: true, title: true, subject: { select: { slug: true } } },
                },
              },
            },
          },
        }),
      ]);

      return {
        kind: "staff",
        stats: {
          subjects: subjects.length,
          activeClasses,
          assignments,
          openSubmissions: groupsWithSubs,
        },
        subjects: subjects.map(toSubjectCard),
        recentUploads: recent.map(toActivity),
      };
    }

    const [subjects, tasks, recent] = await Promise.all([
      db.subject.findMany({
        ...subjectCardArgs,
        where: { enrollments: { some: { userId: user.id } } },
        orderBy: { name: "asc" },
      }),
      studentTasks(user.id),
      studentRecent(user.id),
    ]);

    return { kind: "student", subjects: subjects.map(toSubjectCard), tasks, recent };
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
        assignments: {
          orderBy: { dueDate: "asc" },
          include: {
            groups: {
              include: {
                _count: { select: { submissions: true } },
                members: { select: { userId: true } },
              },
            },
          },
        },
      },
    });
    if (!subject) throw redirect({ to: "/subjects" });

    if (!staff) {
      const enrolled = await db.enrollment.findUnique({
        where: { userId_subjectId: { userId: user.id, subjectId: subject.id } },
      });
      if (!enrolled) throw redirect({ to: "/subjects" });
    }

    const assignments: AssignmentOverview[] = subject.assignments.map((a) => {
      const submittedCount = a.groups.filter((g) => g._count.submissions > 0).length;
      let myStatus: TaskStatus | null = null;
      if (!staff) {
        const mine = a.groups.find((g) => g.members.some((m) => m.userId === user.id));
        myStatus = mine ? statusOf(mine._count.submissions, a.dueDate) : "pending";
      }
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        dueAt: a.dueDate.toISOString(),
        groupCount: a.groups.length,
        submittedCount,
        myStatus,
      };
    });

    return {
      ...toSubjectCard(subject),
      assignments,
      pages: subject.pages.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        template: p.template === "assignments" ? ("assignments" as const) : ("content" as const),
      })),
    };
  });

/** One subject page (content + metadata). Enrollment is enforced like getSubject. */
export const getSubjectPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ subjectSlug: z.string(), pageSlug: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();

    const page = await db.subjectPage.findFirst({
      where: { slug: data.pageSlug, subject: { slug: data.subjectSlug } },
      include: {
        subject: { select: { id: true } },
        files: { orderBy: { order: "asc" } },
      },
    });
    if (!page) throw redirect({ to: "/subjects/$slug", params: { slug: data.subjectSlug } });

    if (!isStaff(user.role)) {
      const enrolled = await db.enrollment.findUnique({
        where: { userId_subjectId: { userId: user.id, subjectId: page.subject.id } },
      });
      if (!enrolled) throw redirect({ to: "/subjects" });
    }

    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      template: page.template === "assignments" ? ("assignments" as const) : ("content" as const),
      content: page.content,
      updatedAt: page.updatedAt.toISOString(),
      files: page.files.map((f) => ({
        id: f.id,
        label: f.label,
        fileName: f.fileName,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        category: f.category,
        description: f.description,
      })),
    };
  });

// --- assignment detail ---

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

    if (!staff) {
      const enrolled = await db.enrollment.findUnique({
        where: { userId_subjectId: { userId: user.id, subjectId: assignment.subject.id } },
      });
      if (!enrolled) throw redirect({ to: "/subjects" });
    }

    // Students only see their own group; staff see every group.
    const groupRows = await db.group.findMany({
      where: staff
        ? { assignmentId: id }
        : { assignmentId: id, members: { some: { userId: user.id } } },
      orderBy: { name: "asc" },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        submissions: {
          orderBy: { version: "desc" },
          include: { uploadedBy: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    const groups: GroupView[] = groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      members: g.members.map((m) => ({
        id: m.user.id,
        name: `${m.user.firstName} ${m.user.lastName}`,
      })),
      versions: g.submissions.map(
        (s): VersionItem => ({
          id: s.id,
          version: s.version,
          fileName: s.fileName,
          fileSize: s.fileSize,
          uploadedById: s.uploadedById,
          uploadedByName: `${s.uploadedBy.firstName} ${s.uploadedBy.lastName}`,
          uploadedAt: s.createdAt.toISOString(),
          note: s.note,
        }),
      ),
    }));

    const myGroup = staff
      ? null
      : groupRows.find((g) => g.members.some((m) => m.user.id === user.id));

    return {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      dueAt: assignment.dueDate.toISOString(),
      subjectName: assignment.subject.name,
      subjectSlug: assignment.subject.slug,
      theme: asTheme(assignment.subject.themeStyle),
      canUpload: !!myGroup,
      myGroupId: myGroup?.id ?? null,
      groups,
    };
  });

/** Enrolled students for an assignment's subject, flagged if already grouped. */
export const getAssignmentStudents = createServerFn({ method: "GET" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    const user = await requireUser();
    if (!isStaff(user.role)) throw redirect({ to: "/" });

    const assignment = await db.assignment.findUnique({
      where: { id },
      select: { subjectId: true },
    });
    if (!assignment) throw new Error("Úkol nenalezen.");

    const [enrollments, grouped] = await Promise.all([
      db.enrollment.findMany({
        where: { subjectId: assignment.subjectId },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      }),
      db.groupMember.findMany({ where: { group: { assignmentId: id } }, select: { userId: true } }),
    ]);
    const groupedSet = new Set(grouped.map((g) => g.userId));

    return enrollments.map((e) => ({
      id: e.user.id,
      name: `${e.user.firstName} ${e.user.lastName}`,
      inGroup: groupedSet.has(e.user.id),
    }));
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

// --- classes (staff) ---

export const getClasses = createServerFn({ method: "GET" }).handler(
  async (): Promise<ClassWithSubjects[]> => {
    const user = await requireUser();
    if (!isStaff(user.role)) throw redirect({ to: "/" });

    const classes = await db.class.findMany({
      orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
      include: {
        subjects: {
          select: {
            id: true,
            name: true,
            slug: true,
            themeStyle: true,
            enrollments: { select: { userId: true } },
          },
        },
      },
    });

    return classes.map((c) => {
      const students = new Set<string>();
      for (const s of c.subjects) for (const e of s.enrollments) students.add(e.userId);
      return {
        id: c.id,
        name: c.name,
        schoolYear: c.schoolYear,
        isArchived: c.isArchived,
        studentCount: students.size,
        subjects: c.subjects.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          theme: asTheme(s.themeStyle),
        })),
      };
    });
  },
);

// --- admin overview (staff) ---

export const getAdminData = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminData> => {
    const user = await requireUser();
    if (!isStaff(user.role)) throw redirect({ to: "/" });

    const [users, classes, subjects] = await Promise.all([
      db.user.findMany({ orderBy: [{ role: "asc" }, { lastName: "asc" }] }),
      db.class.findMany({
        orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
        include: {
          _count: { select: { subjects: true } },
          subjects: { select: { enrollments: { select: { userId: true } } } },
        },
      }),
      db.subject.findMany({ ...subjectCardArgs, orderBy: { name: "asc" } }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        role: u.role === "ADMIN" || u.role === "TEACHER" ? u.role : "STUDENT",
      })),
      classes: classes.map((c) => {
        const students = new Set<string>();
        for (const s of c.subjects) for (const e of s.enrollments) students.add(e.userId);
        return {
          id: c.id,
          name: c.name,
          schoolYear: c.schoolYear,
          isArchived: c.isArchived,
          subjectCount: c._count.subjects,
          studentCount: students.size,
        };
      }),
      subjects: subjects.map(toSubjectCard),
    };
  },
);
