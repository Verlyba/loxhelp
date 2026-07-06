import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Search, Shuffle, Trash2, UserPlus, Users2, X } from "lucide-react";
import { requireStaff } from "@/lib/guards";
import { getSubjectGroups } from "@/lib/data";
import {
  createStudyGroup,
  deleteStudyGroup,
  setStudentStudyGroup,
  addStudentToStudyGroup,
  removeStudentFromStudyGroup,
  createPair,
  deletePair,
  generatePairsInGroup,
  enrollStudents,
  unenrollStudent,
} from "@/lib/actions";
import type { StudyGroupView, SubjectGroupsData } from "@/lib/types";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";

export const Route = createFileRoute("/subjects/$slug/groups")({
  beforeLoad: ({ context }) => {
    requireStaff(context.user);
  },
  loader: ({ params }) => getSubjectGroups({ data: params.slug }),
  head: () => ({
    meta: [{ title: "Skupiny a dvojice — Školka" }],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const data = Route.useLoaderData() as SubjectGroupsData;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="mb-1 font-display text-2xl font-semibold text-foreground">
          Skupiny a dvojice
        </h2>
        <p className="text-sm text-muted-foreground">
          Rozdělení třídy na učební skupiny a dvojice pro odevzdávání úkolů.
        </p>
      </div>

      <div>
        <StepHeader n={1} title="Zápis do kurzu" hint="Kdo z třídy v kurzu je a kdo chybí." />
        <EnrollBox data={data} />
      </div>

      <div>
        <StepHeader
          n={2}
          title="Učební skupiny a dvojice"
          hint="Zapsané studenty rozdělte do skupin (L1, L2, …) a v nich vytvořte dvojice — ručně výběrem, nebo rozlosováním zbytku."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {data.studyGroups.map((g) => (
            <StudyGroupCard key={g.id} group={g} data={data} />
          ))}
          <CreateGroupCard subjectId={data.subjectId} />
        </div>
      </div>

      {data.unassigned.length > 0 && (
        <div className="surface-card p-5">
          <h3 className="font-display font-semibold text-foreground">
            Bez učební skupiny ({data.unassigned.length})
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Zapsaní studenti bez přiřazení — přidejte je v kartě skupiny.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.unassigned.map((s) => (
              <span
                key={s.id}
                className="rounded-full bg-muted px-2.5 py-1 text-sm font-medium text-foreground"
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <EnrolledStudentsList data={data} />
    </section>
  );
}

/** Numbered step header — makes the group-setup flow read top-to-bottom. */
function StepHeader({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-subject text-sm font-bold text-[color:var(--subject-foreground)]">
        {n}
      </span>
      <div>
        <h3 className="font-display font-semibold leading-7 text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function EnrollBox({ data }: { data: SubjectGroupsData }) {
  const router = useRouter();
  const enroll = useServerFn(enrollStudents);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      await enroll({ data: { subjectId: data.subjectId, userIds: selected } });
      setSelected([]);
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface-card p-5">
      <h3 className="flex items-center gap-2 font-display font-semibold text-foreground">
        <UserPlus className="h-4.5 w-4.5 text-subject" /> Zapsat do kurzu
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Studenti třídy, kteří ještě nejsou v kurzu.
      </p>

      {data.notEnrolled.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground italic">
          Všichni studenti třídy jsou již v tomto kurzu zapsaní.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.notEnrolled.map((s) => (
              <label
                key={s.id}
                className={`cursor-pointer rounded-full px-2.5 py-1 text-sm ring-1 transition-colors select-none ${
                  selected.includes(s.id)
                    ? "bg-subject-soft ring-subject/40 font-medium text-foreground"
                    : "bg-muted ring-transparent hover:ring-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  onChange={() => toggle(s.id)}
                  className="sr-only"
                />
                {s.name}
              </label>
            ))}
          </div>
          <button
            onClick={submit}
            disabled={busy || selected.length === 0}
            className="subject-button mt-3 !px-3 !py-1.5 text-xs disabled:opacity-60 font-semibold"
          >
            {busy ? "Zapisuji…" : `Zapsat vybrané (${selected.length})`}
          </button>
        </>
      )}
    </div>
  );
}

function StudyGroupCard({ group, data }: { group: StudyGroupView; data: SubjectGroupsData }) {
  const router = useRouter();
  const assign = useServerFn(setStudentStudyGroup);
  const addStudent = useServerFn(addStudentToStudyGroup);
  const removeStudent = useServerFn(removeStudentFromStudyGroup);
  const delGroup = useServerFn(deleteStudyGroup);
  const delPair = useServerFn(deletePair);
  const mkPair = useServerFn(createPair);
  const shuffle = useServerFn(generatePairsInGroup);
  const enroll = useServerFn(enrollStudents);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { confirm } = useDialog();

  const unpaired = group.members.filter((m) => !m.pairName);

  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length < 3 ? [...s, id] : s,
    );

  const handleToggleStudent = async (studentId: string, isMember: boolean, isEnrolled: boolean) => {
    setBusy(true);
    try {
      if (isMember) {
        await removeStudent({ data: { userId: studentId, studyGroupId: group.id } });
      } else {
        if (!isEnrolled) {
          await enroll({ data: { subjectId: data.subjectId, userIds: [studentId] } });
        }
        await addStudent({ data: { userId: studentId, studyGroupId: group.id } });
      }
      await router.invalidate();
    } catch (err) {
      console.error("Chyba při správě člena skupiny:", err);
    } finally {
      setBusy(false);
    }
  };

  // Combine all students from groups, unassigned, and notEnrolled to get a complete class list
  const allClassStudents = [
    ...data.studyGroups.flatMap((g) => g.members.map((m) => ({ id: m.id, name: m.name }))),
    ...data.unassigned.map((s) => ({ id: s.id, name: s.name })),
    ...data.notEnrolled.map((s) => ({ id: s.id, name: s.name })),
  ];

  // Deduplicate by student ID
  const seenIds = new Set<string>();
  const uniqueClassStudents = allClassStudents.filter((s) => {
    if (seenIds.has(s.id)) return false;
    seenIds.add(s.id);
    return true;
  });

  const memberIds = new Set(group.members.map((m) => m.id));
  const notEnrolledIds = new Set(data.notEnrolled.map((s) => s.id));

  const studentsList = uniqueClassStudents.map((s) => ({
    id: s.id,
    name: s.name,
    isMember: memberIds.has(s.id),
    isEnrolled: !notEnrolledIds.has(s.id),
  }));

  studentsList.sort((a, b) => a.name.localeCompare(b.name));

  const filteredStudents = studentsList.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      setSelected([]);
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <Users2 className="h-4.5 w-4.5 text-subject" /> {group.name}
          <span className="text-xs font-normal text-muted-foreground">
            {group.members.length} studentů
          </span>
        </h3>
        <button
          onClick={async () => {
            const ok = await confirm({
              title: `Smazat skupinu ${group.name}?`,
              message: `Skupina bude smazána. Studenti v ní zařazení budou přesunuti do nezařazených. Dvojice v této skupině budou také smazány.`,
              danger: true,
            });
            if (ok) run(() => delGroup({ data: group.id }));
          }}
          aria-label={`Smazat skupinu ${group.name}`}
          className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Pairs */}
      {group.pairs.length > 0 && (
        <ul className="mt-3 grid gap-1.5">
          {group.pairs.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5 text-sm bg-card"
            >
              <span className="text-foreground">
                <span className="font-semibold text-subject">{p.name}:</span>{" "}
                {p.members.map((m) => m.name).join(" + ")}
              </span>
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: `Zrušit ${p.name}?`,
                    message: `Dvojice ${p.members.map((m) => m.name).join(" + ")} bude zrušena. Studenti zůstanou ve skupině jako nezařazení.`,
                    danger: true,
                  });
                  if (ok) run(() => delPair({ data: p.id }));
                }}
                aria-label={`Zrušit ${p.name}`}
                className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Unpaired members — select 2-3 to form a pair */}
      {unpaired.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">Bez dvojice — vyberte 2–3 a spárujte:</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {unpaired.map((m) => (
              <label
                key={m.id}
                className={`cursor-pointer rounded-full px-2.5 py-1 text-sm ring-1 transition-colors select-none ${
                  selected.includes(m.id)
                    ? "bg-subject-soft ring-subject/40 font-medium text-foreground"
                    : "bg-muted ring-transparent hover:ring-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(m.id)}
                  onChange={() => toggle(m.id)}
                  className="sr-only"
                />
                {m.name}
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() =>
                run(() => mkPair({ data: { studyGroupId: group.id, memberIds: selected } }))
              }
              disabled={busy || selected.length < 2}
              className="subject-button !px-3 !py-1.5 text-xs disabled:opacity-60 font-semibold"
            >
              Spárovat vybrané
            </button>
            <button
              onClick={() => run(() => shuffle({ data: group.id }))}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-60 font-medium text-foreground bg-surface"
            >
              <Shuffle className="h-3.5 w-3.5" /> Rozlosovat zbytek
            </button>
          </div>
        </div>
      )}

      {/* Seznam studentů pro přidávání/odebírání kliknutím */}
      <div className="mt-4 border-t border-border pt-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Členové skupiny (kliknutím přidáte / odeberete):
        </h4>

        {/* Vyhledávací pole, pokud je ve třídě více než 6 studentů */}
        {studentsList.length > 6 && (
          <div className="relative mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrovat studenty podle jména..."
              className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
            />
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
          {filteredStudents.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Žádní studenti neodpovídají hledání
            </p>
          ) : (
            filteredStudents.map((s) => {
              let badgeStyle = "";
              let icon = "+";

              if (s.isMember) {
                badgeStyle = "bg-subject text-white hover:bg-subject/90 shadow-sm";
                icon = "✓";
              } else if (!s.isEnrolled) {
                badgeStyle =
                  "bg-muted/40 hover:bg-muted text-muted-foreground border border-dashed border-border";
              } else {
                badgeStyle = "bg-muted hover:bg-accent text-foreground";
              }

              return (
                <button
                  key={s.id}
                  onClick={() => handleToggleStudent(s.id, s.isMember, s.isEnrolled)}
                  disabled={busy}
                  title={
                    s.isMember
                      ? `Odebrat ze skupiny ${group.name}`
                      : !s.isEnrolled
                        ? `Zapsat do předmětu a přidat do skupiny ${group.name}`
                        : `Přidat do skupiny ${group.name}`
                  }
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors cursor-pointer select-none font-medium flex items-center gap-1 ${badgeStyle} disabled:opacity-60`}
                >
                  <span className="font-semibold text-[10px] opacity-90">{icon}</span>
                  <span>{s.name}</span>
                  {!s.isEnrolled && (
                    <span className="text-[9px] opacity-75 font-normal">(zapsat)</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function CreateGroupCard({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const create = useServerFn(createStudyGroup);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { subjectId, name } });
      setName("");
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="grid h-fit gap-2 rounded-2xl border border-dashed border-border p-5 bg-card"
    >
      <h3 className="flex items-center gap-2 font-display font-semibold text-muted-foreground">
        <Plus className="h-4 w-4" /> Nová učební skupina
      </h3>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Např. L1"
          required
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
        />
        <button
          disabled={busy}
          className="subject-button !px-3 !py-1.5 text-sm disabled:opacity-60 font-semibold"
        >
          {busy ? "…" : "Vytvořit"}
        </button>
      </div>
    </form>
  );
}

function EnrolledStudentsList({ data }: { data: SubjectGroupsData }) {
  const router = useRouter();
  const unenroll = useServerFn(unenrollStudent);
  const [busy, setBusy] = useState(false);
  const { slug } = Route.useParams();
  const { confirm } = useDialog();

  const handleUnenroll = async (userId: string, name: string) => {
    const ok = await confirm({
      title: `Zrušit zápis studenta ${name}?`,
      message: "Student bude odhlášen z tohoto předmětu a odebrán ze své učební skupiny i dvojice.",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await unenroll({ data: { subjectId: data.subjectId, userId } });
      toast.success(`Zápis studenta ${name} byl zrušen.`);
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nepodařilo se zrušit zápis.");
    } finally {
      setBusy(false);
    }
  };

  // Gather all enrolled students and map their groups
  const groupsByUser = new Map<string, string[]>();
  for (const g of data.studyGroups) {
    for (const m of g.members) {
      const list = groupsByUser.get(m.id) ?? [];
      list.push(g.name);
      groupsByUser.set(m.id, list);
    }
  }

  const enrolledStudentsMap = new Map<string, string>();
  for (const g of data.studyGroups) {
    for (const m of g.members) {
      enrolledStudentsMap.set(m.id, m.name);
    }
  }
  for (const s of data.unassigned) {
    enrolledStudentsMap.set(s.id, s.name);
  }

  const enrolledStudents = Array.from(enrolledStudentsMap.entries()).map(([id, name]) => ({
    id,
    name,
    groups: groupsByUser.get(id) ?? [],
  }));

  // Sort by name
  enrolledStudents.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="surface-card p-5 mt-5">
      <h3 className="flex items-center gap-2 font-display font-semibold text-foreground">
        <Users2 className="h-4.5 w-4.5 text-subject" /> Zapsaní studenti ({enrolledStudents.length})
      </h3>
      <p className="mt-1 text-xs text-muted-foreground mb-4">Všichni studenti v kurzu.</p>

      {enrolledStudents.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          V kurzu zatím nejsou zapsaní žádní studenti.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2.5 font-medium px-2">Jméno</th>
                <th className="py-2.5 font-medium px-2">Učební skupina</th>
                <th className="py-2.5 font-medium text-right px-2">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enrolledStudents.map((s) => (
                <tr key={s.id} className="hover:bg-muted/10 transition-colors">
                  <td className="py-2.5 px-2 font-medium">
                    <Link
                      to="/subjects/$slug/students/$sid"
                      params={{ slug, sid: s.id }}
                      className="text-subject hover:underline font-semibold"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex flex-wrap gap-1">
                      {s.groups.length === 0 ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-500">
                          Bez skupiny
                        </span>
                      ) : (
                        s.groups.map((groupName) => (
                          <span
                            key={groupName}
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-subject-soft text-subject ring-1 ring-subject/25"
                          >
                            {groupName}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <button
                      onClick={() => handleUnenroll(s.id, s.name)}
                      disabled={busy}
                      title="Odhlásit z předmětu"
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="text-xs">Zrušit zápis</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
