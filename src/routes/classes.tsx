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
} from "lucide-react";
import { requireStaff } from "@/lib/guards";
import { getClasses } from "@/lib/data";
import {
  createClass,
  updateClass,
  deleteClass,
  setClassArchived,
  setStudentClass,
} from "@/lib/actions";
import type { ClassesData, ClassWithSubjects } from "@/lib/types";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";

export const Route = createFileRoute("/classes")({
  beforeLoad: ({ context }) => {
    requireStaff(context.user);
  },
  loader: () => getClasses(),
  head: () => ({
    meta: [{ title: "Třídy — Školka" }],
  }),
  component: ClassesPage,
});

const inputCls =
  "rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40";

function ClassesPage() {
  const data = Route.useLoaderData() as ClassesData;
  const [showArchived, setShowArchived] = useState(false);

  const list = data.classes.filter((c) => c.isArchived === showArchived);

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold">Třídy</h1>
        </div>
        <div className="inline-flex rounded-md border border-border bg-surface p-1 text-sm">
          <button
            onClick={() => setShowArchived(false)}
            className={`rounded px-3 py-1.5 ${!showArchived ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            Aktivní
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`inline-flex items-center gap-1 rounded px-3 py-1.5 ${showArchived ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            <Archive className="h-3.5 w-3.5" /> Archiv
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-4">
          {list.length === 0 ? (
            <p className="text-muted-foreground">
              {showArchived ? "Žádné archivované třídy." : "Žádné aktivní třídy."}
            </p>
          ) : (
            list.map((c) => <ClassCard key={c.id} cls={c} withoutClass={data.withoutClass} />)
          )}
        </div>

        <div className="space-y-4">
          <CreateClass />
          {data.withoutClass.length > 0 && (
            <div className="surface-card p-5">
              <h3 className="font-display text-sm font-semibold">
                Studenti bez třídy ({data.withoutClass.length})
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Přidáte je tlačítkem + u konkrétní třídy.
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {data.withoutClass.map((s) => (
                  <li key={s.id}>{s.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function ClassCard({
  cls,
  withoutClass,
}: {
  cls: ClassWithSubjects;
  withoutClass: ClassesData["withoutClass"];
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

  return (
    <div className="surface-card overflow-hidden">
      <div className="h-1.5 w-full bg-subject" />
      <div className="p-5">
        {/* Header row: name + actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${inputCls} w-28 font-semibold`}
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
                className="rounded-md bg-primary p-1.5 text-primary-foreground disabled:opacity-60"
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
                className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-semibold">{cls.name}</h3>
              <span className="subject-chip">{cls.schoolYear}</span>
            </div>
          )}

          {!editing && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setEditing(true)}
                title="Upravit název a rok"
                aria-label="Upravit třídu"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {cls.isArchived ? (
                <button
                  onClick={() => run(() => archiveFn({ data: { id: cls.id, isArchived: false } }))}
                  title="Obnovit z archivu"
                  aria-label="Obnovit"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => run(() => archiveFn({ data: { id: cls.id, isArchived: true } }))}
                  title="Archivovat (konec školního roku)"
                  aria-label="Archivovat"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={handleDelete}
                title="Smazat třídu"
                aria-label="Smazat třídu"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Subjects */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cls.subjects.map((s) => (
            <Link
              key={s.id}
              to="/subjects/$slug"
              params={{ slug: s.slug }}
              data-subject-theme={s.theme}
              className="rounded-full bg-subject-soft px-2.5 py-0.5 text-xs font-medium ring-1 ring-subject/30 hover:opacity-80"
            >
              {s.name}
            </Link>
          ))}
          {cls.subjects.length === 0 && (
            <span className="text-xs text-muted-foreground">Zatím žádné předměty.</span>
          )}
        </div>

        {/* Students */}
        <button
          onClick={() => setShowStudents((v) => !v)}
          className="mt-4 text-sm font-medium text-subject underline underline-offset-2 hover:opacity-80"
        >
          {showStudents ? "Skrýt studenty" : `Studenti (${cls.studentCount})`}
        </button>

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
                      <span className="font-semibold text-foreground truncate">{s.name}</span>
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
                      className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-60 transition-colors"
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
                        className="rounded-full bg-surface px-2.5 py-1 text-xs ring-1 ring-border hover:bg-accent disabled:opacity-60 transition-colors"
                      >
                        + {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface-card grid gap-3 p-5">
      <h2 className="flex items-center gap-2 font-display font-semibold">
        <Plus className="h-4 w-4 text-subject" /> Nová třída
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
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Ukládám…" : "Vytvořit třídu"}
      </button>
    </form>
  );
}
