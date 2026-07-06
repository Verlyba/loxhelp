import { db } from "@/lib/db";

// Server-only (imported from server-fn handlers and scripts).
//
// Randomly pairs up members of a study group who aren't in any pair of that
// group yet. A lone leftover joins the last pair as a trio. Pair names
// continue the existing "Dvojice N" numbering within the group.
export async function generatePairsInGroupCore(
  studyGroupId: string,
): Promise<{ created: number; paired: number }> {
  const group = await db.studyGroup.findUnique({
    where: { id: studyGroupId },
    include: {
      members: { select: { userId: true } },
      pairs: { include: { members: { select: { userId: true } } } },
    },
  });
  if (!group) throw new Error("Učební skupina nenalezena.");

  const paired = new Set(group.pairs.flatMap((p) => p.members.map((m) => m.userId)));
  const pool = group.members.map((m) => m.userId).filter((id) => !paired.has(id));

  // Fisher–Yates shuffle.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const chunks: string[][] = [];
  for (let i = 0; i + 1 < pool.length; i += 2) chunks.push([pool[i], pool[i + 1]]);
  if (pool.length % 2 === 1) {
    const last = pool[pool.length - 1];
    if (chunks.length > 0) chunks[chunks.length - 1].push(last);
    else chunks.push([last]);
  }

  let counter = 0;
  for (const p of group.pairs) {
    const m = /^Dvojice (\d+)$/.exec(p.name);
    if (m) counter = Math.max(counter, Number(m[1]));
  }

  for (const memberIds of chunks) {
    counter += 1;
    await db.pair.create({
      data: {
        studyGroupId,
        name: `Dvojice ${counter}`,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
    });
  }

  return { created: chunks.length, paired: pool.length };
}
