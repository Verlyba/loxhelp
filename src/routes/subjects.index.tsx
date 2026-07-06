import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowUpRight,
  Pencil,
  Trash2,
  Plus,
  X,
  BookOpen,
  Users2,
  BarChart3,
  ExternalLink,
  BookPlus,
} from "lucide-react";
import { requireUser } from "@/lib/guards";
import { getSubjectsManagementData } from "@/lib/data";
import { deleteSubject, createSubject, updateSubject } from "@/lib/actions";
import { isStaff } from "@/lib/roles";
import { useUser } from "@/lib/use-user";
import type { SubjectCard } from "@/lib/types";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";
import { PageShell } from "@/components/page-shell";

type ManagedSubject = SubjectCard & {
  teacherId: string | null;
  teacherName: string | null;
  classId: string;
};

export const Route = createFileRoute("/subjects/")({
  beforeLoad: ({ context }) => {
    requireUser(context.user);
  },
  loader: () => getSubjectsManagementData(),
  head: () => ({
    meta: [{ title: "Předměty — Školka" }],
  }),
  component: SubjectsIndex,
});

const inputCls =
  "rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40";

function SubjectsIndex() {
  const user = useUser();
  const { subjects, classes, teachers } = Route.useLoaderData() as {
    subjects: ManagedSubject[];
    classes: { id: string; name: string; schoolYear: string }[];
    teachers: { id: string; firstName: string; lastName: string }[];
  };

  const staff = user ? isStaff(user.role) : false;

  if (!staff) {
    return <StudentSubjectsView subjects={subjects} />;
  }

  return <StaffSubjectsView subjects={subjects} classes={classes} teachers={teachers} />;
}

/* ================= Student View ================= */

function StudentSubjectsView({ subjects }: { subjects: SubjectCard[] }) {
  return (
    <PageShell
      eyebrow="Vaše kurzy"
      title="Předměty"
      subtitle="Každý předmět má vlastní stránky, úkoly a materiály."
    >
      {subjects.length === 0 ? (
        <p className="text-muted-foreground">Zatím nejste přiřazeni k žádnému předmětu.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {subjects.map((s) => (
            <Link
              key={s.id}
              to="/subjects/$slug"
              params={{ slug: s.slug }}
              data-subject-theme={s.theme}
              className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-8 transition-shadow hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="subject-grid-bg absolute inset-0 opacity-60" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-6">
                  <span className="h-2.5 w-2.5 rounded-full bg-subject" />
                  <span className="subject-chip">
                    {s.className} · {s.schoolYear}
                  </span>
                </div>
                <h2 className="font-display text-2xl font-semibold">{s.name}</h2>
                <p className="mt-2 text-muted-foreground">{s.description}</p>
                <div className="mt-8 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {s.studentCount} studentů · {s.assignmentCount} úkolů
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-subject">
                    Otevřít
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}

/* ================= Staff View ================= */

function StaffSubjectsView({
  subjects,
  classes,
  teachers,
}: {
  subjects: ManagedSubject[];
  classes: { id: string; name: string; schoolYear: string }[];
  teachers: { id: string; firstName: string; lastName: string }[];
}) {
  const router = useRouter();
  const del = useServerFn(deleteSubject);
  const [editing, setEditing] = useState<ManagedSubject | null>(null);
  const { confirm } = useDialog();

  const handleDelete = async (s: ManagedSubject) => {
    const ok = await confirm({
      title: `Smazat předmět „${s.name}“?`,
      message: "Smažou se všechny jeho stránky, úkoly, odevzdání i známky. Akce je nevratná.",
      danger: true,
    });
    if (!ok) return;
    try {
      await del({ data: s.id });
      toast.success(`Předmět „${s.name}“ byl smazán.`);
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nepodařilo se smazat předmět.");
    }
  };

  return (
    <PageShell
      eyebrow="Výuka"
      title="Předměty"
      subtitle="Správa a vytváření předmětů — kliknutím otevřete kurz, skupiny nebo přehled třídy."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 content-start">
          {subjects.length === 0 ? (
            <p className="text-muted-foreground">Zatím nebyly vytvořeny žádné předměty.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {subjects.map((s) => (
                <div
                  key={s.id}
                  data-subject-theme={s.theme}
                  className="surface-card flex flex-col justify-between p-6 overflow-hidden relative"
                >
                  <div className="subject-grid-bg absolute inset-0 opacity-60 pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-subject" />
                        <span className="subject-chip">
                          {s.className} · {s.schoolYear}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {s.studentCount} stud.
                      </span>
                    </div>
                    <h2 className="font-display text-xl font-bold">{s.name}</h2>
                    {s.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {s.description}
                      </p>
                    )}
                    <div className="mt-4 text-xs text-muted-foreground">
                      Učitel: <span className="font-semibold">{s.teacherName ?? "—"}</span>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-1.5 border-t border-border pt-4 text-xs relative">
                    <Link
                      to="/subjects/$slug"
                      params={{ slug: s.slug }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Otevřít
                    </Link>
                    <Link
                      to="/subjects/$slug/groups"
                      params={{ slug: s.slug }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
                    >
                      <Users2 className="h-3.5 w-3.5" /> Skupiny
                    </Link>
                    <Link
                      to="/subjects/$slug/overview"
                      params={{ slug: s.slug }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
                    >
                      <BarChart3 className="h-3.5 w-3.5" /> Přehled
                    </Link>
                    <div className="flex-1" />
                    <button
                      title="Upravit"
                      onClick={() => setEditing(s)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      title="Smazat"
                      onClick={() => handleDelete(s)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <CreateSubject classes={classes} teachers={teachers} />
        </div>
      </div>

      {editing && (
        <EditSubjectModal
          subject={editing}
          classes={classes}
          teachers={teachers}
          onClose={() => setEditing(null)}
        />
      )}
    </PageShell>
  );
}

/* ================= Helper Components ================= */

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-elevated)]">
        <header className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function CreateSubject({
  classes,
  teachers,
}: {
  classes: { id: string; name: string; schoolYear: string }[];
  teachers: { id: string; firstName: string; lastName: string }[];
}) {
  const router = useRouter();
  const create = useServerFn(createSubject);
  const active = classes;
  const [form, setForm] = useState({
    name: "",
    description: "",
    themeStyle: "default" as "loxone" | "cad3d" | "default",
    classId: active[0]?.id ?? "",
    teacherId: teachers[0]?.id ?? "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.classId) return;
    setBusy(true);
    try {
      await create({ data: form });
      setForm({ ...form, name: "", description: "" });
      await router.invalidate();
      toast.success("Předmět byl úspěšně vytvořen.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nepodařilo se vytvořit předmět.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface-card grid gap-3 p-5">
      <h3 className="flex items-center gap-2 font-display font-semibold">
        <BookPlus className="h-4.5 w-4.5 text-subject" /> Nový předmět
      </h3>
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nejdřív vytvořte třídu na stránce Třídy.</p>
      ) : (
        <>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Název předmětu"
            required
            className={inputCls}
          />
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Popis (nepovinné)"
            className={inputCls}
          />
          <div className="grid gap-3">
            <label className="block text-xs font-semibold text-muted-foreground">
              Třída
              <select
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                className={`${inputCls} mt-1 w-full`}
              >
                {active.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.schoolYear})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Učitel
              <select
                value={form.teacherId}
                onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                className={`${inputCls} mt-1 w-full`}
              >
                <option value="">Bez učitele</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Motiv
              <select
                value={form.themeStyle}
                onChange={(e) =>
                  setForm({ ...form, themeStyle: e.target.value as typeof form.themeStyle })
                }
                className={`${inputCls} mt-1 w-full`}
              >
                <option value="default">Neutrální</option>
                <option value="loxone">Loxone (zelená)</option>
                <option value="cad3d">3D CAD (modrá)</option>
              </select>
            </label>
          </div>
          <button
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 mt-2"
          >
            <Plus className="h-4 w-4" /> {busy ? "Uklám…" : "Vytvořit předmět"}
          </button>
        </>
      )}
    </form>
  );
}

function EditSubjectModal({
  subject,
  classes,
  teachers,
  onClose,
}: {
  subject: ManagedSubject;
  classes: { id: string; name: string; schoolYear: string }[];
  teachers: { id: string; firstName: string; lastName: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const update = useServerFn(updateSubject);
  const [form, setForm] = useState({
    name: subject.name,
    description: subject.description,
    themeStyle: subject.theme as "loxone" | "cad3d" | "default",
    classId: subject.classId,
    teacherId: subject.teacherId ?? "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await update({
        data: {
          id: subject.id,
          name: form.name,
          description: form.description,
          themeStyle: form.themeStyle,
          classId: form.classId,
          teacherId: form.teacherId || null,
        },
      });
      await router.invalidate();
      toast.success("Předmět byl úspěšně upraven.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nepodařilo se upravit předmět.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Upravit: ${subject.name}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <label className="block text-xs font-semibold text-muted-foreground">
          Název
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className={`${inputCls} mt-1 w-full`}
          />
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          Popis
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className={`${inputCls} mt-1 w-full resize-none`}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-muted-foreground">
            Třída
            <select
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              className={`${inputCls} mt-1 w-full`}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.schoolYear})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            Učitel
            <select
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              className={`${inputCls} mt-1 w-full`}
            >
              <option value="">Bez učitele</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-xs font-semibold text-muted-foreground">
          Motiv
          <select
            value={form.themeStyle}
            onChange={(e) =>
              setForm({ ...form, themeStyle: e.target.value as typeof form.themeStyle })
            }
            className={`${inputCls} mt-1 w-full`}
          >
            <option value="default">Neutrální</option>
            <option value="loxone">Loxone (zelená)</option>
            <option value="cad3d">3D CAD (modrá)</option>
          </select>
        </label>
        <div className="mt-3 flex justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Storno
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Ukládám…" : "Uložit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
