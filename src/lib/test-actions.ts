import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, requireStaff } from "@/lib/actions";
import { isStaff } from "@/lib/roles";

// --- test CRUD ---

export const createTest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        subjectId: z.string().min(1),
        title: z.string().min(1),
        description: z.string().default(""),
        timeLimit: z.number().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const created = await db.test.create({
      data: {
        subjectId: data.subjectId,
        title: data.title,
        description: data.description,
        timeLimit: data.timeLimit ?? null,
      },
    });
    return { id: created.id };
  });

export const updateTest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        timeLimit: z.number().nullable().optional(),
        isPublished: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const updateData: {
      title?: string;
      description?: string;
      timeLimit?: number | null;
      isPublished?: boolean;
    } = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.timeLimit !== undefined) updateData.timeLimit = data.timeLimit;
    if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;

    await db.test.update({
      where: { id: data.id },
      data: updateData,
    });
    return { ok: true };
  });

export const deleteTest = createServerFn({ method: "POST" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    await requireStaff();
    await db.test.delete({ where: { id } });
    return { ok: true };
  });

// --- question CRUD ---

export const createQuestion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        testId: z.string().min(1),
        text: z.string().min(1),
        type: z.enum(["SINGLE", "MULTIPLE", "TEXT"]),
        points: z.number().min(1).default(1),
        options: z
          .array(
            z.object({
              text: z.string().min(1),
              isCorrect: z.boolean().default(false),
            }),
          )
          .default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();

    // Determine order
    const last = await db.question.findFirst({
      where: { testId: data.testId },
      orderBy: { order: "desc" },
    });
    const order = (last?.order ?? 0) + 1;

    const created = await db.question.create({
      data: {
        testId: data.testId,
        text: data.text,
        type: data.type,
        points: data.points,
        order,
        options: {
          create: data.options.map((opt, idx) => ({
            text: opt.text,
            isCorrect: opt.isCorrect,
            order: idx,
          })),
        },
      },
    });

    return { id: created.id };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .inputValidator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    await requireStaff();
    await db.question.delete({ where: { id } });
    return { ok: true };
  });

// --- test attempts & taking ---

export const startTestAttempt = createServerFn({ method: "POST" })
  .inputValidator((testId: string) => z.string().parse(testId))
  .handler(async ({ data: testId }) => {
    const user = await requireUser();

    // Check if test exists and is published
    const test = await db.test.findUnique({
      where: { id: testId },
    });
    if (!test) throw new Error("Test nenalezen.");
    if (!test.isPublished && !isStaff(user.role)) {
      throw new Error("Test zatím není publikován.");
    }

    // Check if there is an active running attempt
    const active = await db.testAttempt.findFirst({
      where: { testId, userId: user.id, submittedAt: null },
    });
    if (active) {
      return { attemptId: active.id };
    }

    // Check if completed attempt exists
    const completed = await db.testAttempt.findFirst({
      where: { testId, userId: user.id, submittedAt: { not: null } },
    });
    if (completed && !isStaff(user.role)) {
      throw new Error("Tento test jste již odevzdali.");
    }

    const created = await db.testAttempt.create({
      data: {
        testId,
        userId: user.id,
        startedAt: new Date(),
      },
    });

    return { attemptId: created.id };
  });

export const submitTestAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        attemptId: z.string().min(1),
        answers: z.array(
          z.object({
            questionId: z.string().min(1),
            text: z.string().nullable().optional(),
            selectedOptionIds: z.array(z.string()).nullable().optional(),
          }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();

    const attempt = await db.testAttempt.findUnique({
      where: { id: data.attemptId },
      include: {
        test: {
          include: {
            questions: {
              include: { options: true },
            },
          },
        },
      },
    });

    if (!attempt) throw new Error("Pokus nenalezen.");
    if (attempt.userId !== user.id) throw new Error("Tento pokus vám nepatří.");
    if (attempt.submittedAt) throw new Error("Tento pokus již byl odevzdán.");

    const questions = attempt.test.questions;
    let autoScore = 0;
    let pendingManualGrading = false;

    // Use transaction to write answers and update attempt
    await db.$transaction(async (tx) => {
      for (const ans of data.answers) {
        const q = questions.find((x) => x.id === ans.questionId);
        if (!q) continue;

        let points: number | null = 0;

        if (q.type === "TEXT") {
          points = null; // Requires manual grading
          pendingManualGrading = true;
        } else if (q.type === "SINGLE") {
          const selectedId = ans.selectedOptionIds?.[0];
          const correctOption = q.options.find((o) => o.isCorrect);
          if (selectedId && correctOption && selectedId === correctOption.id) {
            points = q.points;
            autoScore += q.points;
          }
        } else if (q.type === "MULTIPLE") {
          const selectedIds = ans.selectedOptionIds ?? [];
          const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);

          // Exact match check: selected matches correct exactly
          const allCorrectSelected = correctIds.every((id) => selectedIds.includes(id));
          const noIncorrectSelected = selectedIds.every((id) => correctIds.includes(id));

          if (allCorrectSelected && noIncorrectSelected && correctIds.length > 0) {
            points = q.points;
            autoScore += q.points;
          }
        }

        // Create answer row
        await tx.answer.create({
          data: {
            attemptId: attempt.id,
            questionId: q.id,
            text: ans.text || null,
            points,
            selectedOptions: {
              connect: (ans.selectedOptionIds ?? []).map((id) => ({ id })),
            },
          },
        });
      }

      // Mark the rest of unanswered questions as 0 points
      const answeredQuestionIds = data.answers.map((a) => a.questionId);
      const unanswered = questions.filter((q) => !answeredQuestionIds.includes(q.id));
      for (const uq of unanswered) {
        if (uq.type === "TEXT") {
          pendingManualGrading = true;
        }
        await tx.answer.create({
          data: {
            attemptId: attempt.id,
            questionId: uq.id,
            points: uq.type === "TEXT" ? null : 0,
          },
        });
      }

      // Update attempt
      await tx.testAttempt.update({
        where: { id: attempt.id },
        data: {
          submittedAt: new Date(),
          score: pendingManualGrading ? null : autoScore,
        },
      });
    });

    return { ok: true };
  });

// --- teacher grading ---

export const gradeTestAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        attemptId: z.string().min(1),
        feedback: z.string().nullable().optional(),
        answersPoints: z.array(
          z.object({
            answerId: z.string().min(1),
            points: z.number().min(0),
            feedback: z.string().nullable().optional(),
          }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();

    const attempt = await db.testAttempt.findUnique({
      where: { id: data.attemptId },
      include: {
        answers: true,
      },
    });
    if (!attempt) throw new Error("Pokus nenalezen.");

    await db.$transaction(async (tx) => {
      // Update individual manual question answers
      for (const ap of data.answersPoints) {
        await tx.answer.update({
          where: { id: ap.answerId },
          data: {
            points: ap.points,
            feedback: ap.feedback || null,
          },
        });
      }

      // Reload answers to calculate total score
      const updatedAnswers = await tx.answer.findMany({
        where: { attemptId: data.attemptId },
      });

      const totalScore = updatedAnswers.reduce((sum, a) => sum + (a.points ?? 0), 0);

      await tx.testAttempt.update({
        where: { id: data.attemptId },
        data: {
          score: totalScore,
          feedback: data.feedback || null,
        },
      });
    });

    return { ok: true };
  });
