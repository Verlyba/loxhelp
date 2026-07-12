import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, requireStaff } from "@/lib/actions";
import { isStaff, type Role } from "@/lib/roles";

// Helper to check subject enrollment or staff
async function assertEnrolledOrStaff(user: { id: string; role: Role }, subjectId: string) {
  if (isStaff(user.role)) return;
  const enrolled = await db.enrollment.findUnique({
    where: { userId_subjectId: { userId: user.id, subjectId } },
  });
  if (!enrolled) throw redirect({ to: "/subjects" });
}

// The countdown that enforces a test's time limit runs entirely in the
// student's browser (setInterval + auto-submit) — nothing on the server
// checks it, so a closed tab, a throttled background timer, or a direct
// call to submitTestAttempt would otherwise be silently accepted as if
// submitted on time. Rather than reject a late submission outright (which
// would strand a student mid-test with no way to retry), every read path
// below surfaces `isLate` so the teacher — and the student, for fairness —
// can see it and grade accordingly.
const LATE_GRACE_MS = 30_000; // network/latency slack for the auto-submit request itself

function isAttemptLate(
  timeLimit: number | null,
  startedAt: Date,
  submittedAt: Date | null,
): boolean {
  if (!timeLimit || !submittedAt) return false;
  const deadline = startedAt.getTime() + timeLimit * 60 * 1000 + LATE_GRACE_MS;
  return submittedAt.getTime() > deadline;
}

export const getTestsList = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => z.string().parse(slug))
  .handler(async ({ data: slug }) => {
    const user = await requireUser();
    const staff = isStaff(user.role);

    const subject = await db.subject.findUnique({
      where: { slug },
    });
    if (!subject) throw redirect({ to: "/subjects" });
    await assertEnrolledOrStaff(user, subject.id);

    // Query tests
    const tests = await db.test.findMany({
      where: {
        subjectId: subject.id,
        ...(staff ? {} : { isPublished: true }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { questions: true } },
        attempts: {
          where: staff ? {} : { userId: user.id },
          orderBy: { startedAt: "desc" },
          select: {
            id: true,
            userId: true,
            startedAt: true,
            submittedAt: true,
            score: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return {
      subjectName: subject.name,
      subjectSlug: subject.slug,
      subjectId: subject.id,
      tests: tests.map((t) => {
        // Find latest attempt for current student
        const myAttempt = staff ? null : (t.attempts[0] ?? null);

        // Calculate max possible points for the test
        return {
          id: t.id,
          title: t.title,
          description: t.description,
          isPublished: t.isPublished,
          timeLimit: t.timeLimit,
          questionCount: t._count.questions,
          myAttempt: myAttempt
            ? {
                id: myAttempt.id,
                startedAt: myAttempt.startedAt.toISOString(),
                submittedAt: myAttempt.submittedAt?.toISOString() ?? null,
                score: myAttempt.score,
                isLate: isAttemptLate(t.timeLimit, myAttempt.startedAt, myAttempt.submittedAt),
              }
            : null,
          attemptsCount: t.attempts.length, // Total attempts (staff can see this)
        };
      }),
    };
  });

export const getTestDetail = createServerFn({ method: "GET" })
  .inputValidator((testId: string) => z.string().parse(testId))
  .handler(async ({ data: testId }) => {
    const user = await requireUser();
    const staff = isStaff(user.role);

    const test = await db.test.findUnique({
      where: { id: testId },
      include: {
        subject: { select: { id: true, name: true, slug: true, themeStyle: true } },
        questions: {
          orderBy: { order: "asc" },
          include: {
            options: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (!test) throw new Error("Test neexistuje.");
    await assertEnrolledOrStaff(user, test.subject.id);

    if (!test.isPublished && !staff) {
      throw redirect({ to: "/subjects/$slug", params: { slug: test.subject.slug } });
    }

    // Check if the student has a completed attempt
    const myAttempt = await db.testAttempt.findFirst({
      where: { testId, userId: user.id },
      orderBy: { startedAt: "desc" },
    });

    const isSubmitted = myAttempt && myAttempt.submittedAt !== null;
    const showCorrectAnswers = staff || isSubmitted;

    // Calculate max score
    const maxPoints = test.questions.reduce((sum, q) => sum + q.points, 0);

    return {
      id: test.id,
      title: test.title,
      description: test.description,
      timeLimit: test.timeLimit,
      isPublished: test.isPublished,
      maxPoints,
      subject: {
        id: test.subject.id,
        name: test.subject.name,
        slug: test.subject.slug,
        theme: test.subject.themeStyle,
      },
      myAttempt: myAttempt
        ? {
            id: myAttempt.id,
            startedAt: myAttempt.startedAt.toISOString(),
            submittedAt: myAttempt.submittedAt?.toISOString() ?? null,
            score: myAttempt.score,
            feedback: myAttempt.feedback,
            isLate: isAttemptLate(test.timeLimit, myAttempt.startedAt, myAttempt.submittedAt),
          }
        : null,
      questions: test.questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        points: q.points,
        options: q.options.map((o) => ({
          id: o.id,
          text: o.text,
          // Security gate: only expose correct answer flags to staff or students who submitted
          isCorrect: showCorrectAnswers ? o.isCorrect : undefined,
        })),
      })),
    };
  });

export const getTestAttempt = createServerFn({ method: "GET" })
  .inputValidator((attemptId: string) => z.string().parse(attemptId))
  .handler(async ({ data: attemptId }) => {
    const user = await requireUser();
    const staff = isStaff(user.role);

    const attempt = await db.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        test: {
          include: {
            subject: { select: { id: true, name: true, slug: true } },
            questions: {
              orderBy: { order: "asc" },
              include: { options: { orderBy: { order: "asc" } } },
            },
          },
        },
        answers: {
          include: { selectedOptions: true },
        },
      },
    });

    if (!attempt) throw new Error("Pokus nenalezen.");
    await assertEnrolledOrStaff(user, attempt.test.subject.id);

    if (attempt.userId !== user.id && !staff) {
      throw new Error("Nemáte oprávnění prohlížet tento pokus.");
    }

    const maxPoints = attempt.test.questions.reduce((sum, q) => sum + q.points, 0);

    return {
      id: attempt.id,
      testId: attempt.test.id,
      testTitle: attempt.test.title,
      timeLimit: attempt.test.timeLimit,
      studentName: `${attempt.user.firstName} ${attempt.user.lastName}`,
      studentId: attempt.user.id,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      score: attempt.score,
      feedback: attempt.feedback,
      isLate: isAttemptLate(attempt.test.timeLimit, attempt.startedAt, attempt.submittedAt),
      maxPoints,
      subject: {
        name: attempt.test.subject.name,
        slug: attempt.test.subject.slug,
      },
      questions: attempt.test.questions.map((q) => {
        const studentAnswer = attempt.answers.find((a) => a.questionId === q.id) ?? null;
        return {
          id: q.id,
          text: q.text,
          type: q.type,
          points: q.points,
          options: q.options.map((o) => ({
            id: o.id,
            text: o.text,
            isCorrect: o.isCorrect,
          })),
          studentAnswer: studentAnswer
            ? {
                id: studentAnswer.id,
                text: studentAnswer.text,
                points: studentAnswer.points,
                feedback: studentAnswer.feedback,
                selectedOptionIds: studentAnswer.selectedOptions.map((so) => so.id),
              }
            : null,
        };
      }),
    };
  });

export const getTestAttemptsAll = createServerFn({ method: "GET" })
  .inputValidator((testId: string) => z.string().parse(testId))
  .handler(async ({ data: testId }) => {
    const user = await requireUser();
    await requireStaff();

    const test = await db.test.findUnique({
      where: { id: testId },
      select: { subjectId: true },
    });
    if (!test) throw new Error("Test neexistuje.");

    const attempts = await db.testAttempt.findMany({
      where: { testId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        test: {
          include: {
            questions: { select: { points: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    return attempts.map((a) => {
      const maxPoints = a.test.questions.reduce((sum, q) => sum + q.points, 0);
      return {
        id: a.id,
        studentName: `${a.user.firstName} ${a.user.lastName}`,
        startedAt: a.startedAt.toISOString(),
        submittedAt: a.submittedAt?.toISOString() ?? null,
        score: a.score,
        maxPoints,
        isLate: isAttemptLate(a.test.timeLimit, a.startedAt, a.submittedAt),
      };
    });
  });
