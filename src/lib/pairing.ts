import { db } from "@/lib/db";

// Server-only (imported from server-fn handlers and seed/test scripts).
//
// Splits the subject's enrolled students who are not yet in any group of the
// assignment into random pairs. With an odd student left over, the last group
// becomes a trio. Group names continue the existing "Dvojice N" numbering.
export async function generatePairsCore(
  assignmentId: string,
): Promise<{ created: number; grouped: number }> {
  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: { subjectId: true },
  });
  if (!assignment) throw new Error("Úkol nenalezen.");

  const [enrollments, existingMembers, existingGroups] = await Promise.all([
    db.enrollment.findMany({
      where: { subjectId: assignment.subjectId },
      select: { userId: true },
    }),
    db.groupMember.findMany({
      where: { group: { assignmentId } },
      select: { userId: true },
    }),
    db.group.findMany({ where: { assignmentId }, select: { name: true } }),
  ]);

  const taken = new Set(existingMembers.map((m) => m.userId));
  const pool = enrollments.map((e) => e.userId).filter((id) => !taken.has(id));

  // Fisher–Yates shuffle.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Chunk into pairs; a lone leftover joins the last pair as a trio.
  const chunks: string[][] = [];
  for (let i = 0; i + 1 < pool.length; i += 2) chunks.push([pool[i], pool[i + 1]]);
  if (pool.length % 2 === 1) {
    const last = pool[pool.length - 1];
    if (chunks.length > 0) chunks[chunks.length - 1].push(last);
    else chunks.push([last]);
  }

  // Continue numbering after existing "Dvojice N" groups.
  let counter = 0;
  for (const g of existingGroups) {
    const m = /^Dvojice (\d+)$/.exec(g.name);
    if (m) counter = Math.max(counter, Number(m[1]));
  }

  for (const memberIds of chunks) {
    counter += 1;
    await db.group.create({
      data: {
        assignmentId,
        name: `Dvojice ${counter}`,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
    });
  }

  return { created: chunks.length, grouped: pool.length };
}
