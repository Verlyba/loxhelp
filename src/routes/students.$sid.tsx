import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ChevronLeft,
  KeyRound,
  Pencil,
  Trash2,
  Users2,
  BookOpen,
  GraduationCap,
  Upload,
  X,
  FileSpreadsheet,
  ClipboardList,
  Inbox,
} from "lucide-react";
import { requireStaff } from "@/lib/guards";
import { getStudentProfile } from "@/lib/data";
import { updateUser, deleteUser, setUserPassword } from "@/lib/actions";
import { formatDate, formatDateTime } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { useDialog } from "@/components/dialog-provider";
import { PairActivityChart } from "@/components/pair-activity-chart";
import { ModalBackdrop } from "@/components/modal-backdrop";
import { toast } from "sonner";
import type { StudentProfileData, TaskStatus } from "@/lib/types";
import { INITIAL_PASSWORD } from "@/lib/constants";

const STATUS_CHIP: Record<TaskStatus | "none", { label: string; cls: string }> = {
  overdue: {
    label: "Po termínu",
    cls: "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/20 dark:text-red-400 dark:ring-red-900/30",
  },
  pending: {
    label: "K odevzdání",
    cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:ring-amber-900/30",
  },
  submitted: {
    label: "Odevzdáno",
    cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:ring-emerald-900/30",
  },
  none: {
    label: "Nezařazeno",
    cls: "bg-muted text-muted-foreground ring-1 ring-border",
  },
};

export const Route = createFileRoute("/students/$sid")({
  beforeLoad: ({ context }) => {
    requireStaff(context.user);
  },
  loader: ({ params }) => getStudentProfile({ data: params.sid }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.student.name} — Shtroodle` }] : [],
  }),
  component: StudentProfilePage,
});

const inputCls =
  "rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40";

function StudentProfilePage() {
  const data = Route.useLoaderData() as StudentProfileData;
  const router = useRouter();
  const { confirm } = useDialog();
  const deleteFn = useServerFn(deleteUser);
  const passwordFn = useServerFn(setUserPassword);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const initials = (data.student.firstName[0] + (data.student.lastName[0] ?? ""))
    .toUpperCase()
    .slice(0, 2);
  const pairChartsBySubject = new Map(data.pairCharts.map((pc) => [pc.subjectId, pc]));

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Smazat účet ${data.student.name}?`,
      message: "Smažou se i zápisy, odevzdání a známky studenta. Akce je nevratná.",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteFn({ data: data.student.id });
      toast.success("Účet studenta smazán.");
      router.navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smazání selhalo.");
    } finally {
      setBusy(false);
    }
  };

  const handlePassword = async () => {
    const ok = await confirm({
      title: `Resetovat heslo pro ${data.student.name}?`,
      message: `Heslo se nastaví na sdílené výchozí heslo (${INITIAL_PASSWORD}) a student si ho bude muset při příštím přihlášení změnit na vlastní.`,
    });
    if (!ok) return;
    await passwordFn({ data: { id: data.student.id } });
    toast.success("Heslo bylo resetováno na výchozí — student si ho musí při přihlášení změnit.");
  };

  return (
    <PageShell
      eyebrow="Karta žáka"
      title={data.student.name}
      subtitle={`${data.student.email} · účet od ${formatDate(data.student.createdAt)}`}
      actions={
        <>
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Pencil className="h-3.5 w-3.5" /> Upravit
          </button>
          <button
            onClick={handlePassword}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-accent"
          >
            <KeyRound className="h-3.5 w-3.5" /> Nové heslo
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Smazat účet
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Zpět na správu
        </Link>

        {/* Premium Profile Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
          {/* Visual Header Banner */}
          <div className="h-24 w-full bg-gradient-to-r from-subject/30 via-subject/20 to-subject/5 relative">
            <div className="subject-grid-bg absolute inset-0 opacity-35" />
          </div>

          {/* Main Card Content */}
          <div className="px-6 pb-6 pt-0 relative flex flex-col md:flex-row md:items-end justify-between gap-5 -mt-10">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
              {/* Circular Avatar overlapping the banner */}
              <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-subject text-2xl font-extrabold text-[color:var(--subject-foreground)] border-4 border-surface shadow-md select-none">
                {initials}
              </span>
              <div className="min-w-0 pb-1">
                <p className="font-display text-xl font-extrabold text-foreground leading-tight">
                  {data.student.name}
                </p>
                <p className="text-sm text-muted-foreground mt-1 font-medium">
                  Třída:{" "}
                  {data.student.className ? (
                    <Link
                      to="/classes"
                      className="font-semibold text-foreground hover:text-subject hover:underline"
                    >
                      {data.student.className}
                    </Link>
                  ) : (
                    <span className="italic">bez třídy</span>
                  )}
                </p>
              </div>
            </div>

            {/* Stats widgets */}
            <div className="grid grid-cols-3 gap-3 text-center self-center sm:self-auto min-w-[240px]">
              <Mini label="Nahraných" value={String(data.stats.totalUploads)} icon={Upload} />
              <Mini label="Známek" value={String(data.stats.gradedCount)} icon={GraduationCap} />
              <Mini label="Průměr" value={data.stats.avgGrade ?? "—"} icon={GraduationCap} />
            </div>
          </div>
        </div>

        {/* Enrolled subjects — per-course overview, incl. pair comparison */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <BookOpen className="h-5 w-5 text-subject" /> Kurzy ({data.subjects.length})
          </h2>
          {data.subjects.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Student není zapsán v žádném kurzu.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.subjects.map((s) => {
                const pairChart = pairChartsBySubject.get(s.id);
                return (
                  <div key={s.id} data-subject-theme={s.theme} className="surface-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to="/subjects/$slug"
                        params={{ slug: s.slug }}
                        className="font-medium hover:underline"
                      >
                        {s.name}
                      </Link>
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-subject" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {s.studyGroup && (
                        <Link
                          to="/subjects/$slug/groups"
                          params={{ slug: s.slug }}
                          className="inline-flex items-center gap-1 rounded-full bg-subject-soft px-2 py-0.5 ring-1 ring-subject/30 hover:opacity-85"
                        >
                          <Users2 className="h-3 w-3" /> {s.studyGroup}
                        </Link>
                      )}
                      {s.pair && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                          {s.pair}
                        </span>
                      )}
                    </div>
                    <Link
                      to="/subjects/$slug/students/$sid"
                      params={{ slug: s.slug, sid: data.student.id }}
                      className="mt-3 inline-block text-xs font-medium text-subject underline underline-offset-2 hover:opacity-80"
                    >
                      Výsledky v kurzu →
                    </Link>

                    {pairChart && (
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <PairActivityChart
                          title="Přehled dvojice"
                          subtitle={`${pairChart.pairName} — kdo tento týden nahrál`}
                          lanes={
                            pairChart.partner ? [pairChart.me, pairChart.partner] : [pairChart.me]
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <ClipboardList className="h-5 w-5 text-subject" /> Přehled úkolů (
            {data.assignments.length})
          </h2>
          {data.assignments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              V žádném kurzu zatím nejsou zadané žádné úkoly.
            </p>
          ) : (
            <div className="surface-card overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Úkol</th>
                    <th className="px-3 py-2.5 font-medium">Předmět</th>
                    <th className="px-3 py-2.5 font-medium">Termín</th>
                    <th className="px-3 py-2.5 text-right font-medium">Stav</th>
                    <th className="px-3 py-2.5 text-center font-medium">Známka</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.assignments.map((a) => {
                    const chip = STATUS_CHIP[a.status];
                    return (
                      <tr key={a.assignmentId} className="hover:bg-accent/40 transition-colors">
                        <td className="px-4 py-2.5">
                          <Link
                            to="/subjects/$slug/assignments/$aid"
                            params={{ slug: a.subjectSlug, aid: a.assignmentId }}
                            className="flex items-center gap-2 font-medium text-foreground hover:text-subject hover:underline"
                          >
                            <Inbox className="h-3.5 w-3.5 shrink-0 text-subject" />
                            <span className="truncate">{a.title}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          <Link
                            to="/subjects/$slug"
                            params={{ slug: a.subjectSlug }}
                            className="hover:text-subject hover:underline"
                          >
                            {a.subjectName}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {formatDateTime(a.dueAt)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip.cls}`}
                          >
                            {chip.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {a.grade ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-subject-soft text-xs font-extrabold text-subject ring-1 ring-subject/20">
                              {a.grade}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {data.moodleResults.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
              <FileSpreadsheet className="h-5 w-5 text-subject" /> Testy z Moodle (
              {data.moodleResults.length})
            </h2>
            <div className="surface-card overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Test</th>
                    <th className="px-3 py-2.5 font-medium">Předmět</th>
                    <th className="px-3 py-2.5 font-medium">Datum</th>
                    <th className="px-3 py-2.5 text-center font-medium">Body</th>
                    <th className="px-3 py-2.5 text-center font-medium">Známka</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.moodleResults.map((r, i) => (
                    <tr key={i} className="hover:bg-accent/40 transition-colors">
                      <td className="px-4 py-2 font-medium text-foreground">{r.testTitle}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <Link
                          to="/subjects/$slug"
                          params={{ slug: r.subjectSlug }}
                          className="hover:text-subject hover:underline"
                        >
                          {r.subjectName}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.attemptAt ? formatDate(r.attemptAt) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                        {r.rawScore.toString().replace(".", ",")} / {r.maxPoints}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-subject-soft text-xs font-extrabold text-subject ring-1 ring-subject/20">
                          {r.grade}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {editing && <EditModal data={data} onClose={() => setEditing(false)} />}
    </PageShell>
  );
}

function Mini({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Upload }) {
  return (
    <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 min-w-20 flex flex-col items-center justify-center shadow-sm">
      <div className="flex items-center gap-1 text-subject">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-display text-base font-extrabold leading-none">{value}</span>
      </div>
      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-1 text-center select-none leading-tight">
        {label}
      </span>
    </div>
  );
}

function EditModal({ data, onClose }: { data: StudentProfileData; onClose: () => void }) {
  const router = useRouter();
  const update = useServerFn(updateUser);
  const [form, setForm] = useState({
    firstName: data.student.firstName,
    lastName: data.student.lastName,
    email: data.student.email,
    classId: data.student.classId,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await update({ data: { id: data.student.id, role: "STUDENT", ...form } });
      await router.invalidate();
      toast.success("Údaje uloženy.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uložení selhalo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose} ariaLabel="Upravit žáka">
      <form
        onSubmit={submit}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-elevated)]"
      >
        <header className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <h3 className="font-display text-lg font-bold">Upravit žáka</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid gap-3 p-6">
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="Jméno"
              required
              className={inputCls}
            />
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Příjmení"
              required
              className={inputCls}
            />
          </div>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email"
            required
            className={inputCls}
          />
          <select
            value={form.classId ?? ""}
            onChange={(e) => setForm({ ...form, classId: e.target.value || null })}
            className={inputCls}
          >
            <option value="">Bez třídy</option>
            {data.classes
              .filter((c) => !c.isArchived || c.id === form.classId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.schoolYear})
                </option>
              ))}
          </select>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Zrušit
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Ukládám…" : "Uložit"}
          </button>
        </footer>
      </form>
    </ModalBackdrop>
  );
}
