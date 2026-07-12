import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ChevronLeft,
  MessageSquareText,
  Users2,
  Pencil,
  Trash2,
  KeyRound,
  X,
  Check,
  Clock,
  Upload,
  GraduationCap,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { requireStaff } from "@/lib/guards";
import { getStudentCard } from "@/lib/data";
import { updateUser, deleteUser, setUserPassword } from "@/lib/actions";
import { formatDateTime, formatDate } from "@/lib/format";
import { TARGET_LABEL, type StudentCardData, type StudentCardRow } from "@/lib/types";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";
import { ModalBackdrop } from "@/components/modal-backdrop";
import { INITIAL_PASSWORD } from "@/lib/constants";

export const Route = createFileRoute("/subjects/$slug/students/$sid")({
  beforeLoad: ({ context }) => {
    requireStaff(context.user);
  },
  loader: ({ params }) => getStudentCard({ data: { slug: params.slug, studentId: params.sid } }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.student.name} — Shtroodle` }] : [],
  }),
  component: StudentCardPage,
});

function StudentCardPage() {
  const data = Route.useLoaderData() as StudentCardData;
  const { slug } = Route.useParams();
  const router = useRouter();
  const { confirm } = useDialog();
  const deleteUserFn = useServerFn(deleteUser);
  const setPasswordFn = useServerFn(setUserPassword);

  const [showEditModal, setShowEditModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const initials = data.student.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleDeleteStudent = async () => {
    const ok = await confirm({
      title: `Smazat studenta ${data.student.name}?`,
      message:
        "Dojde k trvalému odstranění účtu, známek i odevzdaných úkolů studenta. Akce je nevratná!",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await deleteUserFn({ data: data.student.id });
      toast.success("Účet studenta byl smazán.");
      router.navigate({ to: "/subjects/$slug/overview", params: { slug } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba při mazání.");
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    const ok = await confirm({
      title: "Resetovat heslo?",
      message: `Heslo se nastaví na sdílené výchozí heslo (${INITIAL_PASSWORD}) a student si ho bude muset při příštím přihlášení změnit na vlastní.`,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await setPasswordFn({ data: { id: data.student.id } });
      toast.success("Heslo bylo resetováno na výchozí — student si ho musí při přihlášení změnit.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nastavení hesla selhalo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/subjects/$slug/overview"
          params={{ slug }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Zpět na přehled třídy
        </Link>

        {/* Staff CRUD Actions */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Upravit údaje
          </button>
          <button
            onClick={handleResetPassword}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            <KeyRound className="h-3.5 w-3.5" /> Nové heslo
          </button>
          <button
            onClick={handleDeleteStudent}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Smazat účet
          </button>
        </div>
      </div>

      {/* Premium Profile Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
        {/* Visual Header Banner */}
        <div className="h-24 w-full bg-gradient-to-r from-subject/30 via-subject/20 to-subject/5 relative">
          <div className="subject-grid-bg absolute inset-0 opacity-35" />

          {/* Metadata badges inside banner */}
          <div className="absolute top-3 right-3 flex flex-wrap gap-1.5 text-xs">
            {data.studyGroup && (
              <Link
                to="/subjects/$slug/groups"
                params={{ slug }}
                className="inline-flex items-center gap-1 rounded-full bg-surface/85 backdrop-blur-md px-2.5 py-1 font-bold text-subject hover:opacity-90 shadow-sm border border-subject/10"
              >
                <Users2 className="h-3 w-3" /> Skupina {data.studyGroup}
              </Link>
            )}
            {data.pair && (
              <span
                className="rounded-full bg-surface/85 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm border border-border/50"
                title={
                  data.pair.partnerNames.length
                    ? `Partneři: ${data.pair.partnerNames.join(", ")}`
                    : undefined
                }
              >
                {data.pair.name}
                {data.pair.partnerNames.length > 0 && ` · s ${data.pair.partnerNames.join(", ")}`}
              </span>
            )}
          </div>
        </div>

        {/* Main Card Content */}
        <div className="px-6 pb-6 pt-0 relative flex flex-col lg:flex-row lg:items-end justify-between gap-5 -mt-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
            {/* Circular Avatar overlapping the banner */}
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-subject text-2xl font-extrabold text-[color:var(--subject-foreground)] border-4 border-surface shadow-md select-none">
              {initials}
            </span>
            <div className="min-w-0 pb-1">
              <h2 className="font-display text-xl font-extrabold text-foreground leading-tight">
                {data.student.name}
              </h2>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                {data.student.email}
                {data.student.className && (
                  <>
                    {" · "}
                    třída{" "}
                    <Link
                      to="/classes"
                      className="hover:text-subject hover:underline font-semibold text-foreground"
                    >
                      {data.student.className}
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Stats widgets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center self-center lg:self-auto min-w-[280px] sm:min-w-[480px]">
            <Mini
              label="Odevzdáno"
              value={`${data.stats.submitted}/${data.stats.total}`}
              icon={Upload}
            />
            <Mini label="Průměr" value={data.stats.avgGrade ?? "—"} icon={GraduationCap} />
            <Mini
              label="Včasnost"
              value={data.stats.onTimeRate !== null ? `${data.stats.onTimeRate} %` : "—"}
              icon={Clock}
            />
            <Mini label="Verze" value={String(data.stats.totalUploads)} icon={FileText} />
          </div>
        </div>
      </div>

      {showEditModal && (
        <EditStudentModal
          student={data.student}
          classes={data.classes}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* Per-assignment report */}
      <div className="surface-card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm border-collapse">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium border-b border-border bg-muted/10 text-left">
                <span className="block text-foreground font-bold tracking-normal normal-case text-xs">
                  Úkol
                </span>
                <span className="block text-[9px] text-muted-foreground font-normal normal-case mt-0.5">
                  Název a termín
                </span>
              </th>
              <th className="px-3 py-3 font-medium border-b border-border bg-muted/10 text-left">
                <span className="block text-foreground font-bold tracking-normal normal-case text-xs">
                  Stav
                </span>
                <span className="block text-[9px] text-muted-foreground font-normal normal-case mt-0.5">
                  Fáze úkolu
                </span>
              </th>
              <th className="px-3 py-3 font-medium border-b border-border bg-muted/10 text-left">
                <span className="block text-foreground font-bold tracking-normal normal-case text-xs">
                  Odevzdáno
                </span>
                <span className="block text-[9px] text-muted-foreground font-normal normal-case mt-0.5">
                  Poslední nahrání
                </span>
              </th>
              <th className="px-3 py-3 text-center font-medium border-b border-border bg-muted/10">
                <span className="block text-foreground font-bold tracking-normal normal-case text-xs">
                  Verze
                </span>
                <span
                  className="block text-[9px] text-muted-foreground font-normal normal-case mt-0.5"
                  title="Verze studenta / celkem za jednotku"
                >
                  Moje / Celkem
                </span>
              </th>
              <th className="px-3 py-3 text-center font-medium border-b border-border bg-muted/10">
                <span className="block text-foreground font-bold tracking-normal normal-case text-xs">
                  Známka
                </span>
                <span className="block text-[9px] text-muted-foreground font-normal normal-case mt-0.5">
                  Klasifikace
                </span>
              </th>
              <th className="w-10 px-3 py-3 border-b border-border bg-muted/10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {data.rows.map((r) => (
              <Row key={r.assignmentId} row={r} slug={slug} />
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  V kurzu zatím nejsou žádné zadané úkoly.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent uploads */}
      {data.recentUploads.length > 0 && (
        <div className="surface-card p-5">
          <h3 className="mb-3 font-display text-sm font-semibold">Poslední nahrané soubory</h3>
          <ul className="space-y-1.5 text-sm">
            {data.recentUploads.map((u, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span className="mono min-w-0 truncate">{u.fileName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {u.assignmentTitle} · {formatDateTime(u.uploadedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Mini({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="bg-muted/30 border border-border/50 rounded-xl p-2 flex flex-col items-center justify-center shadow-sm">
      <div className="flex items-center gap-1 text-subject">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-display text-xs font-extrabold leading-none">{value}</span>
      </div>
      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-1 text-center select-none leading-tight">
        {label}
      </span>
    </div>
  );
}

function Row({ row, slug }: { row: StudentCardRow; slug: string }) {
  const statusChip =
    row.status === "submitted" ? (
      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
        Odevzdáno{row.onTime === false ? " (pozdě)" : ""}
      </span>
    ) : row.status === "overdue" ? (
      <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
        Po termínu
      </span>
    ) : row.status === "pending" ? (
      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
        Čeká
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">bez skupiny</span>
    );

  return (
    <tr className="transition-colors hover:bg-accent/40">
      <td className="px-4 py-3">
        <Link
          to="/subjects/$slug/assignments/$aid"
          params={{ slug, aid: row.assignmentId }}
          className="font-semibold text-foreground hover:text-subject hover:underline block"
        >
          {row.title}
        </Link>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {TARGET_LABEL[row.targetType]} · termín {formatDate(row.dueAt)}
        </span>
      </td>
      <td className="px-3 py-3">{statusChip}</td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {row.submittedAt ? formatDateTime(row.submittedAt) : "—"}
      </td>
      <td className="px-3 py-3 text-center text-xs">
        <span className="font-semibold text-foreground">{row.myUploads}</span>
        <span className="text-muted-foreground"> / {row.versions}</span>
      </td>
      <td className="px-3 py-3 text-center">
        {row.grade ? (
          <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-subject-soft text-xs font-extrabold text-subject ring-1 ring-subject/20">
            {row.grade}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        {row.feedback && (
          <span title={row.feedback} className="inline-block cursor-help text-subject">
            <MessageSquareText className="h-4 w-4" />
          </span>
        )}
      </td>
    </tr>
  );
}

function EditStudentModal({
  student,
  classes,
  onClose,
}: {
  student: StudentCardData["student"];
  classes: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const update = useServerFn(updateUser);
  const [form, setForm] = useState({
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    role: student.role,
    classId: student.classId,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await update({ data: { id: student.id, ...form } });
      await router.invalidate();
      onClose();
      toast.success("Údaje studenta byly upraveny.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uložení selhalo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalBackdrop
      onClose={onClose}
      ariaLabel={`Upravit studenta: ${student.name}`}
      className="flex items-center justify-center p-4 text-sm"
    >
      <form
        onSubmit={submit}
        className="bg-surface rounded-2xl shadow-elevated border border-border max-w-md w-full overflow-hidden"
      >
        <header className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <h3 className="font-display font-bold text-base text-foreground">
            Upravit studenta: {student.name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-6 grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-muted-foreground">
              Jméno
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Příjmení
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-muted-foreground">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
            />
          </label>

          <label className="block text-xs font-semibold text-muted-foreground">
            Třída
            <select
              value={form.classId ?? ""}
              onChange={(e) => setForm({ ...form, classId: e.target.value || null })}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
            >
              <option value="">Bez třídy</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>

        <footer className="px-6 py-4 border-t border-border bg-muted/25 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Storno
          </button>
          <button
            type="submit"
            disabled={busy}
            className="subject-button rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Ukládám…" : "Uložit změny"}
          </button>
        </footer>
      </form>
    </ModalBackdrop>
  );
}
