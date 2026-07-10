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

/* ================= Cover Presets for Subjects ================= */

const COVER_PRESETS = [
  { name: "Chytrý dům (Loxone)", url: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=600&q=80" },
  { name: "3D CAD & Engineering", url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80" },
  { name: "Programování & Web", url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80" },
  { name: "Počítačové sítě", url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80" },
  { name: "Technologie & Studium", url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80" }
];

/* ================= CourseCard Reuseable Component ================= */

function CourseCard({ s, children }: { s: SubjectCard; children?: React.ReactNode }) {
  const hasImage = !!s.imageUrl;
  return (
    <div
      data-subject-theme={s.theme}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-soft transition-all duration-300 hover:shadow-elevated hover:-translate-y-1 hover:border-subject/30 h-full relative"
    >
      {/* Cover image area */}
      <div className="relative h-40 w-full overflow-hidden bg-muted flex-shrink-0">
        {hasImage ? (
          <img
            src={s.imageUrl!}
            alt={s.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-subject/20 to-subject/5" />
        )}
        <div className="subject-grid-bg absolute inset-0 opacity-40 pointer-events-none" />
        
        {/* Class Badge inside image */}
        <span className="absolute top-3 left-3 bg-black/60 text-[10px] font-bold tracking-wider uppercase text-white rounded-full px-2.5 py-1 backdrop-blur-md border border-white/10 select-none">
          {s.className} · {s.schoolYear}
        </span>
        
        {/* Soft gradient bottom overlay for readability */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent opacity-60 pointer-events-none" />
      </div>

      {/* Content area */}
      <div className="p-5 flex flex-col flex-1 relative">
        <h3 className="font-display text-lg font-bold text-foreground group-hover:text-subject transition-colors line-clamp-1">
          {s.name}
        </h3>
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 min-h-[2.25rem] flex-1">
          {s.description || "Bez popisu předmětu."}
        </p>
        
        {children}
      </div>
    </div>
  );
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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <Link
              key={s.id}
              to="/subjects/$slug"
              params={{ slug: s.slug }}
              className="block h-full"
            >
              <CourseCard s={s}>
                <div className="mt-4 flex items-center justify-between border-t border-border/80 pt-3.5 text-xs text-muted-foreground select-none">
                  <span>
                    {s.studentCount} studentů · {s.assignmentCount} úkolů
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-bold text-subject group-hover:translate-x-0.5 transition-transform">
                    Otevřít →
                  </span>
                </div>
              </CourseCard>
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
                <div key={s.id}>
                  <CourseCard s={s}>
                    <div className="mt-1 text-xs text-muted-foreground flex justify-between items-center">
                      <span>Učitel: <span className="font-semibold text-foreground">{s.teacherName ?? "—"}</span></span>
                      <span className="text-[11px] bg-muted px-2 py-0.5 rounded-full font-medium">{s.studentCount} stud.</span>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-1 border-t border-border/80 pt-3 text-xs relative">
                      <Link
                        to="/subjects/$slug"
                        params={{ slug: s.slug }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 hover:bg-accent text-foreground transition-colors font-medium shadow-sm"
                      >
                        <ExternalLink className="h-3 w-3" /> Otevřít
                      </Link>
                      <Link
                        to="/subjects/$slug/groups"
                        params={{ slug: s.slug }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 hover:bg-accent text-foreground transition-colors font-medium shadow-sm"
                      >
                        <Users2 className="h-3 w-3" /> Skupiny
                      </Link>
                      <Link
                        to="/subjects/$slug/overview"
                        params={{ slug: s.slug }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 hover:bg-accent text-foreground transition-colors font-medium shadow-sm"
                      >
                        <BarChart3 className="h-3 w-3" /> Přehled
                      </Link>
                      <div className="flex-1" />
                      <button
                        title="Upravit"
                        onClick={() => setEditing(s)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="Smazat"
                        onClick={() => handleDelete(s)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </CourseCard>
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
        <div className="p-6 max-h-[85vh] overflow-y-auto">{children}</div>
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
    imageUrl: "",
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
      setForm({ ...form, name: "", description: "", imageUrl: "" });
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
              Obrázek (URL)
              <input
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg (nepovinné)"
                className={`${inputCls} mt-1 w-full`}
              />
            </label>
            
            {/* Presets Grid */}
            <div className="text-xs font-semibold text-muted-foreground">
              Předvolby obrázků
              <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                {COVER_PRESETS.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => setForm({ ...form, imageUrl: preset.url })}
                    className={`relative aspect-video overflow-hidden rounded-md border-2 bg-muted transition-all cursor-pointer ${
                      form.imageUrl === preset.url ? "border-primary scale-95 shadow-sm" : "border-transparent hover:border-muted-foreground/30"
                    }`}
                    title={preset.name}
                  >
                    <img src={preset.url} alt={preset.name} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
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
          </div>
          <button
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 mt-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> {busy ? "Ukládám…" : "Vytvořit předmět"}
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
    imageUrl: subject.imageUrl ?? "",
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
          imageUrl: form.imageUrl || null,
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
        <label className="block text-xs font-semibold text-muted-foreground">
          Obrázek (URL)
          <input
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://example.com/image.jpg (nepovinné)"
            className={`${inputCls} mt-1 w-full`}
          />
        </label>

        {/* Presets Grid */}
        <div className="text-xs font-semibold text-muted-foreground">
          Předvolby obrázků
          <div className="mt-1.5 grid grid-cols-5 gap-1.5">
            {COVER_PRESETS.map((preset) => (
              <button
                key={preset.url}
                type="button"
                onClick={() => setForm({ ...form, imageUrl: preset.url })}
                className={`relative aspect-video overflow-hidden rounded-md border-2 bg-muted transition-all cursor-pointer ${
                  form.imageUrl === preset.url ? "border-primary scale-95 shadow-sm" : "border-transparent hover:border-muted-foreground/30"
                }`}
                title={preset.name}
              >
                <img src={preset.url} alt={preset.name} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

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
        <div className="mt-3 flex justify-end gap-3 border-t border-border/80 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            Storno
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 cursor-pointer"
          >
            {busy ? "Ukládám…" : "Uložit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
