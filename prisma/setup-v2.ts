// One-time setup after the v2 domain migration: assigns students to their
// class, creates study groups (L1/S1) with pairs, and publishes existing
// assignments as PAIR-targeted. Safe to re-run (skips what already exists).
import { db } from "@/lib/db";

async function main() {
  const cls = await db.class.findFirst({ orderBy: { createdAt: "asc" } });
  if (!cls) throw new Error("No class found");

  // 1) All students belong to the class.
  await db.user.updateMany({ where: { role: "STUDENT" }, data: { classId: cls.id } });

  const byEmail = async (email: string) => {
    const u = await db.user.findUnique({ where: { email } });
    if (!u) throw new Error(`missing ${email}`);
    return u;
  };
  const anna = await byEmail("anna@school.cz");
  const petr = await byEmail("petr@school.cz");
  const jana = await byEmail("jana@school.cz");
  const tomas = await byEmail("tomas@school.cz");
  const marek = await byEmail("marek@school.cz");
  const klara = await byEmail("klara@school.cz");
  const honza = await byEmail("honza@school.cz");

  // 2) Study groups + pairs per subject.
  const ensureGroup = async (subjectSlug: string, name: string, memberIds: string[]) => {
    const subject = await db.subject.findUnique({ where: { slug: subjectSlug } });
    if (!subject) return null;
    let group = await db.studyGroup.findFirst({ where: { subjectId: subject.id, name } });
    if (!group) {
      group = await db.studyGroup.create({ data: { subjectId: subject.id, name } });
      for (const userId of memberIds) {
        await db.studyGroupMember.create({ data: { studyGroupId: group.id, userId } });
      }
    }
    return group;
  };

  const ensurePair = async (studyGroupId: string, name: string, memberIds: string[]) => {
    const existing = await db.pair.findFirst({ where: { studyGroupId, name } });
    if (existing) return existing;
    return db.pair.create({
      data: { studyGroupId, name, members: { create: memberIds.map((userId) => ({ userId })) } },
    });
  };

  const l1 = await ensureGroup("loxone", "L1", [anna.id, petr.id, jana.id, tomas.id]);
  if (l1) {
    await ensurePair(l1.id, "Dvojice 1", [anna.id, petr.id]);
    await ensurePair(l1.id, "Dvojice 2", [jana.id, tomas.id]);
  }
  const s1 = await ensureGroup("cad3d", "S1", [marek.id, klara.id, honza.id]);
  if (s1) {
    await ensurePair(s1.id, "Dvojice 1", [marek.id, klara.id, honza.id]);
  }

  // 3) Existing assignments: pair-targeted and published.
  await db.assignment.updateMany({ data: { targetType: "PAIR", isPublished: true } });

  console.log("Setup v2 done:", {
    studyGroups: await db.studyGroup.count(),
    pairs: await db.pair.count(),
    publishedAssignments: await db.assignment.count({ where: { isPublished: true } }),
    studentsInClass: await db.user.count({ where: { classId: cls.id } }),
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
