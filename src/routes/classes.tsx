import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Archive,
  Plus,
  RotateCcw,
  Pencil,
  Trash2,
  UserMinus,
  UserPlus,
  Check,
  X,
  ClipboardPaste,
  Bell,
  Upload,
  Users2,
  BookOpen,
  FileUp,
  ChevronDown,
  Search,
} from "lucide-react";
import { requireStaff } from "@/lib/guards";
import { getClasses } from "@/lib/data";
import {
  createClass,
  updateClass,
  deleteClass,
  setClassArchived,
  setStudentClass,
  createUser,
  updateSubject,
  sendClassNotification,
  deleteClassNotification,
} from "@/lib/actions";
import { useUser } from "@/lib/use-user";
import type { ClassesData, ClassWithSubjects, SubjectCard } from "@/lib/types";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";
import { PageShell } from "@/components/page-shell";
import { PasswordReveal } from "@/components/password-reveal";
import { ModalBackdrop } from "@/components/modal-backdrop";
import type { SubjectTheme } from "@/lib/roles";
import { INITIAL_PASSWORD } from "@/lib/constants";

export const Route = createFileRoute("/classes")({
  beforeLoad: ({ context }) => {
    requireStaff(context.user);
  },
  loader: () => getClasses(),
  head: () => ({
    meta: [{ title: "Třídy — Shtroodle" }],
  }),
  component: ClassesPage,
});

const inputCls =
  "rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40";

function ClassesPage() {
  const data = Route.useLoaderData() as ClassesData;
  const [showArchived, setShowArchived] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const list = data.classes
    .filter((c) => c.isArchived === showArchived)
    .filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.schoolYear.toLowerCase().includes(q),
    );

  return (
    <PageShell
      eyebrow="Organizace"
      title="Třídy"
      subtitle="Správa tříd, studentů a předmětů — žáky přidáváte přímo v seznamu třídy."
      actions={
        <>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-sm hover:bg-accent cursor-pointer"
          >
            <ClipboardPaste className="h-4 w-4 text-subject" /> Hromadný import
          </button>
          <div className="inline-flex rounded-md border border-border bg-surface p-1 text-sm">
            <button
              onClick={() => setShowArchived(false)}
              className={`rounded px-3 py-1.5 cursor-pointer ${!showArchived ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              Aktivní
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={`inline-flex items-center gap-1 rounded px-3 py-1.5 cursor-pointer ${showArchived ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              <Archive className="h-3.5 w-3.5" /> Archiv
            </button>
          </div>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-4">
          {data.classes.filter((c) => c.isArchived === showArchived).length > 4 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hledat třídu podle názvu nebo ročníku…"
                className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          )}

          {list.length === 0 ? (
            <p className="text-muted-foreground">
              {q
                ? `Žádná třída neodpovídá hledání „${query}“.`
                : showArchived
                  ? "Žádné archivované třídy."
                  : "Žádné aktivní třídy."}
            </p>
          ) : (
            list.map((c) => (
              <ClassCard
                key={c.id}
                cls={c}
                withoutClass={data.withoutClass}
                allSubjects={data.allSubjects}
              />
            ))
          )}
        </div>

        <div className="space-y-4">
          <CreateClass />
        </div>
      </div>

      {showImport && (
        <ImportStudentsModal classes={data.classes} onClose={() => setShowImport(false)} />
      )}
    </PageShell>
  );
}

function ClassCard({
  cls,
  withoutClass,
  allSubjects,
}: {
  cls: ClassWithSubjects;
  withoutClass: ClassesData["withoutClass"];
  allSubjects: SubjectCard[];
}) {
  const router = useRouter();
  const archiveFn = useServerFn(setClassArchived);
  const updateFn = useServerFn(updateClass);
  const deleteFn = useServerFn(deleteClass);
  const assignFn = useServerFn(setStudentClass);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cls.name);
  const [schoolYear, setSchoolYear] = useState(cls.schoolYear);
  const [showStudents, setShowStudents] = useState(false);
  const [busy, setBusy] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const { confirm } = useDialog();

  const filteredStudents = cls.students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase()),
  );

  const filteredWithoutClass = withoutClass.filter((s) =>
    s.name.toLowerCase().includes(addSearch.toLowerCase()),
  );

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = () =>
    run(async () => {
      await updateFn({ data: { id: cls.id, name, schoolYear } });
      setEditing(false);
    });

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Smazat třídu ${cls.name}?`,
      message:
        "Smažou se i její předměty se všemi stránkami a odevzdáními. Studenti zůstanou (bez třídy). Akce je nevratná.",
      danger: true,
    });
    if (!ok) return;
    run(async () => {
      try {
        await deleteFn({ data: cls.id });
        toast.success(`Třída ${cls.name} smazána.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Nepodařilo se smazat třídu.");
      }
    });
  };

  const totalAssignments = cls.subjects.reduce((n, s) => n + s.assignmentCount, 0);

  return (
    <div
      className={`surface-card overflow-hidden transition-shadow hover:shadow-elevated ${cls.isArchived ? "opacity-80" : ""}`}
    >
      <div className="flex items-start gap-4 border-b border-border/70 bg-muted/10 p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-subject text-lg font-extrabold text-[color:var(--subject-foreground)] shadow-sm select-none">
          {cls.name.slice(0, 2).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${inputCls} w-28 font-semibold`}
                autoFocus
              />
              <input
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                className={`${inputCls} w-32`}
              />
              <button
                onClick={saveEdit}
                disabled={busy}
                aria-label="Uložit"
                className="rounded-md bg-primary p-1.5 text-primary-foreground disabled:opacity-60 cursor-pointer"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setName(cls.name);
                  setSchoolYear(cls.schoolYear);
                }}
                aria-label="Zrušit"
                className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{cls.name}</h3>
                <span className="subject-chip">{cls.schoolYear}</span>
                {cls.isArchived && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Archive className="h-3 w-3" /> Archiv
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setEditing(true)}
                  title="Upravit název a rok"
                  aria-label="Upravit třídu"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {cls.isArchived ? (
                  <button
                    onClick={() =>
                      run(() => archiveFn({ data: { id: cls.id, isArchived: false } }))
                    }
                    title="Obnovit z archivu"
                    aria-label="Obnovit"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => run(() => archiveFn({ data: { id: cls.id, isArchived: true } }))}
                    title="Archivovat (konec školního roku)"
                    aria-label="Archivovat"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  title="Smazat třídu"
                  aria-label="Smazat třídu"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users2 className="h-3.5 w-3.5" /> {cls.studentCount}{" "}
              {cls.studentCount === 1 ? "student" : cls.studentCount < 5 ? "studenti" : "studentů"}
            </span>
            <span className="inline-flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" /> {cls.subjects.length}{" "}
              {cls.subjects.length === 1
                ? "předmět"
                : cls.subjects.length < 5
                  ? "předměty"
                  : "předmětů"}
            </span>
            <span className="inline-flex items-center gap-1">
              <FileUp className="h-3.5 w-3.5" /> {totalAssignments}{" "}
              {totalAssignments === 1 ? "úkol" : totalAssignments < 5 ? "úkoly" : "úkolů"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-5">
        {/* Subjects */}
        <SectionHeader icon={BookOpen} label="Předměty" />
        <div className="mt-2 flex flex-wrap gap-1.5 items-center">
          {cls.subjects.map((s) => (
            <Link
              key={s.id}
              to="/subjects/$slug"
              params={{ slug: s.slug }}
              data-subject-theme={s.theme}
              className="rounded-full bg-subject-soft px-2.5 py-0.5 text-xs font-medium ring-1 ring-subject/30 hover:opacity-80"
            >
              {s.name}
              {s.assignmentCount > 0 && (
                <span className="ml-1 text-subject/70">· {s.assignmentCount}</span>
              )}
            </Link>
          ))}
          {cls.subjects.length === 0 && (
            <span className="text-xs text-muted-foreground">Zatím žádné předměty.</span>
          )}
        </div>

        {/* Assign Subject Form */}
        <ClassSubjectsAssign cls={cls} allSubjects={allSubjects} />

        {/* Broadcast notifications */}
        <ClassNotificationsSection cls={cls} />

        {/* Students */}
        <div className="mt-4 border-t border-border pt-4">
          <button
            onClick={() => setShowStudents((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-sm font-semibold text-foreground cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Users2 className="h-4 w-4 text-subject" /> Studenti ({cls.studentCount})
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${showStudents ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {showStudents && (
          <div className="mt-2 rounded-lg border border-border">
            {cls.students.length > 5 && (
              <div className="px-3 py-2 border-b border-border bg-muted/20">
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Hledat studenta ve třídě..."
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
                />
              </div>
            )}

            {filteredStudents.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground italic">
                {studentSearch ? "Žádný student neodpovídá vyhledávání." : "Žádní studenti."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {filteredStudents.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <Link
                        to="/students/$sid"
                        params={{ sid: s.id }}
                        title="Otevřít kartu žáka"
                        className="font-semibold text-foreground truncate hover:text-subject hover:underline"
                      >
                        {s.name}
                      </Link>
                      <span className="text-xs text-muted-foreground mr-1">({s.email})</span>

                      {cls.subjects.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {cls.subjects.map((sub) => (
                            <Link
                              key={sub.id}
                              to="/subjects/$slug/students/$sid"
                              params={{ slug: sub.slug, sid: s.id }}
                              data-subject-theme={sub.theme}
                              className="rounded bg-subject-soft px-1.5 py-0.5 text-[10px] font-medium text-subject hover:opacity-85 ring-1 ring-subject/20 transition-opacity"
                              title={`Karta studenta pro předmět ${sub.name}`}
                            >
                              Karta: {sub.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => run(() => assignFn({ data: { userId: s.id, classId: null } }))}
                      disabled={busy}
                      title="Vyřadit ze třídy"
                      aria-label={`Vyřadit ${s.name}`}
                      className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {withoutClass.length > 0 && (
              <div className="border-t border-border bg-muted/40 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <UserPlus className="h-3.5 w-3.5 text-subject" /> Přidat do třídy:
                  </p>

                  {withoutClass.length > 5 && (
                    <input
                      type="text"
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                      placeholder="Hledat k přidání..."
                      className="rounded-md border border-input bg-background px-2 py-0.5 text-[11px] outline-none focus:ring-2 focus:ring-ring/40 text-foreground w-36"
                    />
                  )}
                </div>

                {filteredWithoutClass.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Žádní studenti neodpovídají vyhledávání.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {filteredWithoutClass.map((s) => (
                      <button
                        key={s.id}
                        onClick={() =>
                          run(() => assignFn({ data: { userId: s.id, classId: cls.id } }))
                        }
                        disabled={busy}
                        className="rounded-full bg-surface px-2.5 py-1 text-xs ring-1 ring-border hover:bg-accent disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        + {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Create a brand-new student right here in the class list */}
            <NewStudentInline classId={cls.id} className={cls.name} />
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
      <Icon className="h-4 w-4 text-subject" /> {label}
    </h4>
  );
}

function ClassSubjectsAssign({
  cls,
  allSubjects,
}: {
  cls: ClassWithSubjects;
  allSubjects: SubjectCard[];
}) {
  const router = useRouter();
  const updateSub = useServerFn(updateSubject);
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);

  // Filter subjects that are not already in this class
  const assignable = allSubjects.filter((s) => s.classId !== cls.id);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) return;
    setBusy(true);
    try {
      const sub = allSubjects.find((s) => s.id === subjectId);
      if (!sub) return;
      await updateSub({
        data: {
          id: sub.id,
          name: sub.name,
          description: sub.description,
          themeStyle: sub.theme as SubjectTheme,
          classId: cls.id,
        },
      });
      setSubjectId("");
      await router.invalidate();
      toast.success(`Předmět „${sub.name}“ byl přepsán do třídy ${cls.name}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nepodařilo se přiřadit předmět.");
    } finally {
      setBusy(false);
    }
  };

  if (assignable.length === 0) return null;

  return (
    <form
      onSubmit={handleAssign}
      className="mt-3 flex items-center gap-2 border-t border-border pt-3"
    >
      <select
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
        className={`${inputCls} !py-1 text-xs max-w-[180px]`}
        required
      >
        <option value="">Zapsat předmět...</option>
        {assignable.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.className})
          </option>
        ))}
      </select>
      <button
        disabled={busy}
        type="submit"
        className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 cursor-pointer"
      >
        Zapsat
      </button>
    </form>
  );
}

function ClassNotificationsSection({ cls }: { cls: ClassWithSubjects }) {
  const router = useRouter();
  const sendNotif = useServerFn(sendClassNotification);
  const deleteNotif = useServerFn(deleteClassNotification);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const { confirm } = useDialog();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await sendNotif({ data: { classId: cls.id, title, body } });
      setTitle("");
      setBody("");
      setShowForm(false);
      await router.invalidate();
      toast.success("Oznámení třídě odesláno.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba při odesílání.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, notifTitle: string) => {
    const ok = await confirm({
      title: "Smazat oznámení?",
      message: `Smazat oznámení „${notifTitle}“ pro celou třídu?`,
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteNotif({ data: id });
      await router.invalidate();
      toast.success("Oznámení smazáno.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba při mazání.");
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
          <Bell className="h-4 w-4 text-subject" /> Oznámení třídy ({cls.notifications.length})
        </h4>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs text-subject font-medium hover:underline cursor-pointer"
        >
          {showForm ? "Zavřít" : "Nové oznámení"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSend}
          className="mt-3 grid gap-2.5 rounded-lg bg-muted/20 p-3 border border-border"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Předmět oznámení"
            required
            className={`${inputCls} !py-1 text-xs w-full`}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Text oznámení (nepovinné)"
            rows={2}
            className={`${inputCls} !py-1 text-xs w-full resize-none`}
          />
          <button
            disabled={busy}
            type="submit"
            className="justify-self-end rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 cursor-pointer"
          >
            Odeslat třídě
          </button>
        </form>
      )}

      {cls.notifications.length > 0 && (
        <ul className="mt-2 space-y-2 max-h-40 overflow-y-auto divide-y divide-border/60">
          {cls.notifications.map((n) => (
            <li
              key={n.id}
              className="pt-2 first:pt-0 flex items-start justify-between gap-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">{n.title}</p>
                {n.body && <p className="text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {n.authorName} · {new Date(n.createdAt).toLocaleDateString("cs-CZ")}
                </p>
              </div>
              <button
                onClick={() => handleDelete(n.id, n.title)}
                title="Smazat oznámení"
                className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors shrink-0 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateClass() {
  const router = useRouter();
  const create = useServerFn(createClass);
  const [name, setName] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { name, schoolYear } });
      setName("");
      setSchoolYear("");
      await router.invalidate();
      toast.success("Třída byla vytvořena.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nepodařilo se vytvořit třídu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface-card grid gap-3 p-5">
      <h2 className="flex items-center gap-2 font-display font-semibold text-foreground">
        <Plus className="h-4.5 w-4.5 text-subject" /> Nová třída
      </h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Název (např. 2EB)"
        required
        className={inputCls}
      />
      <input
        value={schoolYear}
        onChange={(e) => setSchoolYear(e.target.value)}
        placeholder="Školní rok (např. 2026/2027)"
        required
        className={inputCls}
      />
      <button
        disabled={busy}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 cursor-pointer"
      >
        {busy ? "Ukládám…" : "Vytvořit třídu"}
      </button>
    </form>
  );
}

/**
 * Creates a brand-new student directly inside the class's student list.
 * No password entry — the account starts on the shared initial password.
 */
function NewStudentInline({ classId, className }: { classId: string; className: string }) {
  const router = useRouter();
  const create = useServerFn(createUser);
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<{ name: string; password: string } | null>(null);

  const autoEmail = () =>
    `${firstName}.${lastName}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z.]/g, "") + "@school.cz";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await create({
        data: {
          firstName,
          lastName,
          email: email.trim() || autoEmail(),
          role: "STUDENT",
          classId,
        },
      });
      await router.invalidate();
      setReveal({ name: `${firstName} ${lastName}`, password: INITIAL_PASSWORD });
      setFirstName("");
      setLastName("");
      setEmail("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nepodařilo se vytvořit účet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-border px-3 py-2.5">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-subject hover:underline cursor-pointer"
        >
          <UserPlus className="h-3.5 w-3.5" /> Nový žák do třídy {className}
        </button>
      ) : (
        <form onSubmit={submit} className="grid gap-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Nový žák — heslo se vygeneruje automaticky a jednou zobrazí.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jméno"
              required
              autoFocus
              className={`${inputCls} !py-1.5 text-xs`}
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Příjmení"
              required
              className={`${inputCls} !py-1.5 text-xs`}
            />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={
              firstName && lastName ? `Email (výchozí: ${autoEmail()})` : "Email (nepovinné)"
            }
            className={`${inputCls} !py-1.5 text-xs`}
          />
          <div className="flex gap-1.5">
            <button
              disabled={busy}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 cursor-pointer"
            >
              {busy ? "Vytvářím…" : "Vytvořit žáka"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent cursor-pointer"
            >
              Zrušit
            </button>
          </div>
        </form>
      )}

      {reveal && (
        <PasswordReveal
          name={reveal.name}
          password={reveal.password}
          onClose={() => setReveal(null)}
        />
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <ModalBackdrop onClose={onClose} ariaLabel={title}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-elevated)]">
        <header className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </ModalBackdrop>
  );
}

function ImportStudentsModal({
  classes,
  onClose,
}: {
  classes: ClassesData["classes"];
  onClose: () => void;
}) {
  const router = useRouter();
  const create = useServerFn(createUser);
  const active = classes.filter((c) => !c.isArchived);
  const [text, setText] = useState("");
  const [classId, setClassId] = useState<string | null>(active[0]?.id ?? null);
  const [password, setPassword] = useState("heslo123");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setText((event.target?.result as string) || "");
      toast.success(`Soubor ${file.name} načten.`);
    };
    reader.readAsText(file);
  };

  const parse = (line: string) => {
    const [namePart, emailPart] = line.split(/[;,\t]/).map((s) => s?.trim());
    if (!namePart) return null;
    const words = namePart.split(/\s+/);
    if (words.length < 2) return null;
    const firstName = words.slice(0, -1).join(" ");
    const lastName = words[words.length - 1];
    const email =
      emailPart && emailPart.includes("@")
        ? emailPart
        : `${firstName}.${lastName}`
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z.]/g, "") + "@school.cz";
    return { firstName, lastName, email };
  };

  const rows = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parse);
  const valid = rows.filter((r): r is NonNullable<typeof r> => r !== null);

  const run = async () => {
    setBusy(true);
    let ok = 0;
    const errors: string[] = [];
    for (const r of valid) {
      try {
        await create({ data: { ...r, role: "STUDENT", password, classId } });
        ok++;
      } catch (err) {
        errors.push(`${r.email}: ${err instanceof Error ? err.message : "chyba"}`);
      }
    }
    await router.invalidate();
    setResult(
      `Vytvořeno ${ok}/${valid.length} účtů.${errors.length ? `\nChyby:\n${errors.join("\n")}` : ""}`,
    );
    setBusy(false);
  };

  return (
    <Modal title="Hromadný import studentů" onClose={onClose}>
      {result ? (
        <div className="grid gap-4">
          <p className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm">{result}</p>
          <button
            onClick={onClose}
            className="justify-self-end rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground cursor-pointer"
          >
            Hotovo
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center">
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">
              Vyberte soubor `.csv` nebo `.txt` se seznamem studentů
            </p>
            <label className="inline-flex items-center justify-center rounded-md bg-surface border border-border px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-accent self-center">
              <span>Vybrat soubor</span>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="relative">
            <div className="absolute top-2 right-2 text-[10px] text-muted-foreground bg-surface/80 px-1 rounded border border-border">
              Obsah schránky / souboru
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder={"Nebo vložte text ručně:\nJan Novotný; jan.novotny@school.cz\nEva Malá"}
              className={`${inputCls} mono w-full leading-relaxed text-xs`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-muted-foreground">
              Zařadit do třídy
              <select
                value={classId ?? ""}
                onChange={(e) => setClassId(e.target.value || null)}
                className={`${inputCls} mt-1 w-full`}
              >
                <option value="">Bez třídy</option>
                {active.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.schoolYear})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Výchozí heslo
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputCls} mt-1 w-full`}
              />
            </label>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">
              Rozpoznáno: {valid.length} studentů
            </span>
            <button
              onClick={run}
              disabled={busy || valid.length === 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 cursor-pointer"
            >
              {busy ? "Vytvářím…" : `Vytvořit ${valid.length} účtů`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
