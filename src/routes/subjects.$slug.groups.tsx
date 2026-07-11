import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Search, Trash2, UserPlus, Users2, X, Pencil, Check } from "lucide-react";
import { PairActivityChart } from "@/components/pair-activity-chart";
import { requireStaff } from "@/lib/guards";
import { getSubjectGroups } from "@/lib/data";
import {
  createStudyGroup,
  updateStudyGroup,
  deleteStudyGroup,
  addStudentToStudyGroup,
  removeStudentFromStudyGroup,
  createPair,
  deletePair,
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

/** Every student of the class, deduped, regardless of enrollment/group state. */
function allClassStudents(data: SubjectGroupsData) {
  const map = new Map<string, string>();
  for (const g of data.studyGroups) for (const m of g.members) map.set(m.id, m.name);
  for (const s of data.unassigned) map.set(s.id, s.name);
  for (const s of data.notEnrolled) map.set(s.id, s.name);
  return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** Which existing group (if any) each student already belongs to, for hints in the picker. */
function groupNameByStudent(data: SubjectGroupsData) {
  const map = new Map<string, string>();
  for (const g of data.studyGroups) for (const m of g.members) map.set(m.id, g.name);
  return map;
}

function GroupsPage() {
  const data = Route.useLoaderData() as SubjectGroupsData;
  const [groupModal, setGroupModal] = useState<
    { mode: "create" } | { mode: "edit"; group: StudyGroupView } | null
  >(null);
  const [groupFilter, setGroupFilter] = useState<string>("all");

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
          hint="Nejprve vytvořte skupinu (L1, L2, …), pak v ní vyberte dvojici dvou studentů."
        />

        <button
          onClick={() => setGroupModal({ mode: "create" })}
          className="subject-button mb-4 inline-flex items-center gap-1.5 !px-3.5 !py-2 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> Nová učební skupina
        </button>

        {data.studyGroups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Zatím nebyla vytvořena žádná učební skupina.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.studyGroups.map((g) => (
              <StudyGroupCard
                key={g.id}
                group={g}
                onEditMembers={() => setGroupModal({ mode: "edit", group: g })}
              />
            ))}
          </div>
        )}
      </div>

      {data.unassigned.length > 0 && (
        <div className="surface-card p-5">
          <h3 className="font-display font-semibold text-foreground">
            Bez učební skupiny ({data.unassigned.length})
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Zapsaní studenti bez přiřazení — přidejte je úpravou členů skupiny.
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

      <EnrolledStudentsList
        data={data}
        groupFilter={groupFilter}
        onGroupFilterChange={setGroupFilter}
      />

      {groupModal && (
        <GroupModal
          data={data}
          mode={groupModal.mode}
          existingGroup={groupModal.mode === "edit" ? groupModal.group : null}
          onClose={() => setGroupModal(null)}
        />
      )}
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

function StudyGroupCard({
  group,
  onEditMembers,
}: {
  group: StudyGroupView;
  onEditMembers: () => void;
}) {
  const router = useRouter();
  const delGroup = useServerFn(deleteStudyGroup);
  const delPair = useServerFn(deletePair);
  const mkPair = useServerFn(createPair);
  const updateGroup = useServerFn(updateStudyGroup);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const { confirm } = useDialog();

  const unpaired = group.members.filter((m) => !m.pairName);

  const toggle = (id: string) =>
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= 2) return [s[1], id]; // keep it at exactly two — swap the oldest pick
      return [...s, id];
    });

  const createTheDvojice = async () => {
    if (selected.length !== 2) return;
    setBusy(true);
    try {
      await mkPair({ data: { studyGroupId: group.id, memberIds: selected } });
      setSelected([]);
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Vytvoření dvojice se nezdařilo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-input bg-background px-2.5 py-1 text-sm outline-none focus:ring-2 focus:ring-ring/40 text-foreground w-40 font-semibold"
            />
            <button
              onClick={async () => {
                if (!name.trim()) return;
                setBusy(true);
                try {
                  await updateGroup({ data: { id: group.id, name } });
                  setEditing(false);
                  await router.invalidate();
                  toast.success("Skupina byla přejmenována.");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Chyba při přejmenování.");
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              aria-label="Uložit"
              className="rounded bg-primary p-1 text-primary-foreground disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setName(group.name);
              }}
              aria-label="Zrušit"
              className="rounded border border-border p-1 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <Users2 className="h-4.5 w-4.5 text-subject" />
            <span>{group.name}</span>
            <button
              onClick={() => setEditing(true)}
              title="Upravit název"
              aria-label="Přejmenovat skupinu"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-normal text-muted-foreground">
              {group.members.length} studentů
            </span>
          </h3>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={onEditMembers}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
          >
            <Users2 className="h-3.5 w-3.5" /> Upravit členy
          </button>
          <button
            onClick={async () => {
              const ok = await confirm({
                title: `Smazat skupinu ${group.name}?`,
                message: `Skupina bude smazána. Studenti v ní zařazení budou přesunuti do nezařazených. Dvojice v této skupině budou také smazány.`,
                danger: true,
              });
              if (!ok) return;
              setBusy(true);
              try {
                await delGroup({ data: group.id });
                await router.invalidate();
              } finally {
                setBusy(false);
              }
            }}
            aria-label={`Smazat skupinu ${group.name}`}
            className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Existing pairs — with a step chart of who's uploaded each week */}
      {group.pairs.length > 0 && (
        <ul className="mt-3 grid gap-2.5">
          {group.pairs.map((p) => (
            <li key={p.id} className="rounded-lg border border-border bg-card px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-sm">
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
                    if (!ok) return;
                    setBusy(true);
                    try {
                      await delPair({ data: p.id });
                      await router.invalidate();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  aria-label={`Zrušit ${p.name}`}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {p.activity.length > 0 && (
                <div className="mt-2 border-t border-border/60 pt-2">
                  <PairActivityChart
                    title=""
                    subtitle="Kdo tento týden nahrál"
                    lanes={p.activity}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Plain table — check exactly two people, create the pair */}
      {unpaired.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Vytvořit dvojici — vyberte dva studenty
          </p>
          <table className="w-full border-collapse text-sm">
            <tbody className="divide-y divide-border/60">
              {unpaired.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className={`cursor-pointer transition-colors ${
                    selected.includes(m.id) ? "bg-subject-soft/50" : "hover:bg-accent/40"
                  }`}
                >
                  <td className="w-8 py-1.5 pl-1">
                    <input
                      type="checkbox"
                      readOnly
                      checked={selected.includes(m.id)}
                      className="h-4 w-4 accent-current text-subject"
                    />
                  </td>
                  <td className="py-1.5 pr-1 text-foreground">{m.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={createTheDvojice}
            disabled={busy || selected.length !== 2}
            className="subject-button mt-3 !px-3 !py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {busy ? "Vytvářím…" : "Vytvořit dvojici"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * One modal, two jobs: create a brand-new group (name + member picker), or
 * edit an existing group's members (picker only). Either way, membership is
 * written by clicking names in a plain list — no drag, no shuffling.
 */
function GroupModal({
  data,
  mode,
  existingGroup,
  onClose,
}: {
  data: SubjectGroupsData;
  mode: "create" | "edit";
  existingGroup: StudyGroupView | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const create = useServerFn(createStudyGroup);
  const addStudent = useServerFn(addStudentToStudyGroup);
  const removeStudent = useServerFn(removeStudentFromStudyGroup);
  const enroll = useServerFn(enrollStudents);

  const [name, setName] = useState(existingGroup?.name ?? "");
  const [selected, setSelected] = useState<string[]>(
    existingGroup ? existingGroup.members.map((m) => m.id) : [],
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const students = allClassStudents(data);
  const groupOf = groupNameByStudent(data);
  const notEnrolledIds = new Set(data.notEnrolled.map((s) => s.id));
  const filtered = students.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async () => {
    setError(null);
    if (mode === "create" && !name.trim()) {
      setError("Zadejte název skupiny.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "create") {
        await create({ data: { subjectId: data.subjectId, name, memberIds: selected } });
        toast.success(`Skupina „${name}“ byla vytvořena.`);
      } else if (existingGroup) {
        const before = new Set(existingGroup.members.map((m) => m.id));
        const after = new Set(selected);
        const added = selected.filter((id) => !before.has(id));
        const removed = existingGroup.members.map((m) => m.id).filter((id) => !after.has(id));
        for (const userId of added) {
          if (notEnrolledIds.has(userId)) {
            await enroll({ data: { subjectId: data.subjectId, userIds: [userId] } });
          }
          await addStudent({ data: { userId, studyGroupId: existingGroup.id } });
        }
        for (const userId of removed) {
          await removeStudent({ data: { userId, studyGroupId: existingGroup.id } });
        }
        toast.success("Členové skupiny byli upraveni.");
      }
      await router.invalidate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uložení se nezdařilo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-elevated)]"
      >
        <header className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <h3 className="font-display text-lg font-bold text-foreground">
            {mode === "create" ? "Nová učební skupina" : `Členové skupiny ${existingGroup?.name}`}
          </h3>
          <button
            onClick={onClose}
            aria-label="Zavřít"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[75vh] overflow-y-auto p-6">
          {mode === "create" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Název skupiny, např. L1"
              autoFocus
              className="mb-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
            />
          )}

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Klikněte na studenty, kteří budou ve skupině ({selected.length})
          </p>
          {students.length > 6 && (
            <div className="relative mb-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrovat podle jména…"
                className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
              />
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}

          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground italic">Nikdo neodpovídá hledání.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {filtered.map((s) => {
                  const isChecked = selected.includes(s.id);
                  const existingGroupName = groupOf.get(s.id);
                  const inOtherGroup =
                    existingGroupName && existingGroupName !== existingGroup?.name;
                  return (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent/40">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggle(s.id)}
                          className="h-4 w-4 accent-current text-subject"
                        />
                        <span className="flex-1 text-foreground">{s.name}</span>
                        {inOtherGroup && (
                          <span className="text-[10px] text-muted-foreground">
                            v {existingGroupName}
                          </span>
                        )}
                        {notEnrolledIds.has(s.id) && (
                          <span className="text-[10px] text-muted-foreground">(zapsat)</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Zrušit
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="subject-button rounded-lg px-3.5 py-1.5 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Ukládám…" : mode === "create" ? "Vytvořit skupinu" : "Uložit členy"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function EnrolledStudentsList({
  data,
  groupFilter,
  onGroupFilterChange,
}: {
  data: SubjectGroupsData;
  groupFilter: string;
  onGroupFilterChange: (v: string) => void;
}) {
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
    for (const m of g.members) enrolledStudentsMap.set(m.id, m.name);
  }
  for (const s of data.unassigned) enrolledStudentsMap.set(s.id, s.name);

  let enrolledStudents = Array.from(enrolledStudentsMap.entries()).map(([id, name]) => ({
    id,
    name,
    groups: groupsByUser.get(id) ?? [],
  }));

  if (groupFilter === "none") {
    enrolledStudents = enrolledStudents.filter((s) => s.groups.length === 0);
  } else if (groupFilter !== "all") {
    enrolledStudents = enrolledStudents.filter((s) => s.groups.includes(groupFilter));
  }

  enrolledStudents.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="surface-card p-5 mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display font-semibold text-foreground">
          <Users2 className="h-4.5 w-4.5 text-subject" /> Zapsaní studenti (
          {enrolledStudents.length})
        </h3>
        {data.studyGroups.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Skupina:
            <select
              value={groupFilter}
              onChange={(e) => onGroupFilterChange(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/40"
            >
              <option value="all">Všechny</option>
              {data.studyGroups.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
              <option value="none">Bez skupiny</option>
            </select>
          </label>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground mb-4">Všichni studenti v kurzu.</p>

      {enrolledStudents.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Žádní studenti neodpovídají zvolenému filtru.
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
