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
} from "lucide-react";
import { requireStaff } from "@/lib/guards";
import { getStudentCard } from "@/lib/data";
import { updateUser, deleteUser, setUserPassword } from "@/lib/actions";
import { formatDateTime, formatDate } from "@/lib/format";
import { TARGET_LABEL, type StudentCardData, type StudentCardRow } from "@/lib/types";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";

export const Route = createFileRoute("/subjects/$slug/students/$sid")({
  beforeLoad: ({ context }) => {
    requireStaff(context.user);
  },
  loader: ({ params }) => getStudentCard({ data: { slug: params.slug, studentId: params.sid } }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.student.name} — Školka` }] : [],
  }),
  component: StudentCardPage,
});

function StudentCardPage() {
  const data = Route.useLoaderData() as StudentCardData;
  const { slug } = Route.useParams();
  const router = useRouter();
  const { confirm, prompt } = useDialog();
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
    const pw = await prompt({
      title: "Nastavit nové heslo",
      message: "Zadejte nové přístupové heslo pro studenta (min. 4 znaky).",
      defaultValue: "heslo123",
      confirmLabel: "Nastavit heslo",
    });
    if (!pw) return;
    if (pw.length < 4) {
      toast.error("Heslo musí mít alespoň 4 znaky.");
      return;
    }

    setBusy(true);
    try {
      await setPasswordFn({ data: { id: data.student.id, password: pw } });
      toast.success("Nové heslo bylo úspěšně nastaveno.");
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

      {/* Identity */}
      <header className="flex flex-wrap items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-subject text-lg font-bold text-[color:var(--subject-foreground)]">
          {initials}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold">{data.student.name}</h2>
          <p className="text-sm text-muted-foreground">
            {data.student.email}
            {data.student.className && (
              <>
                {" · "}
                třída{" "}
                <Link to="/classes" className="hover:underline font-semibold text-foreground">
                  {data.student.className}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5 text-xs">
          {data.studyGroup && (
            <Link
              to="/subjects/$slug/groups"
              params={{ slug }}
              className="inline-flex items-center gap-1 rounded-full bg-subject-soft px-2.5 py-1 font-medium ring-1 ring-subject/30 hover:opacity-85"
            >
              <Users2 className="h-3.5 w-3.5 text-subject" /> {data.studyGroup}
            </Link>
          )}
          {data.pair && (
            <span
              className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground"
              title={
                data.pair.partnerNames.length
                  ? `S: ${data.pair.partnerNames.join(", ")}`
                  : undefined
              }
            >
              {data.pair.name}
              {data.pair.partnerNames.length > 0 && ` · s ${data.pair.partnerNames.join(", ")}`}
            </span>
          )}
        </div>
      </header>

      {showEditModal && (
        <EditStudentModal
          student={data.student}
          classes={data.classes}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Odevzdáno" value={`${data.stats.submitted}/${data.stats.total}`} />
        <Stat label="Průměr známek" value={data.stats.avgGrade ?? "—"} />
        <Stat
          label="Včas odevzdané"
          value={data.stats.onTimeRate !== null ? `${data.stats.onTimeRate} %` : "—"}
        />
        <Stat label="Nahraných verzí" value={String(data.stats.totalUploads)} />
      </div>

      {/* Per-assignment report */}
      <div className="surface-card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Úkol</th>
              <th className="px-3 py-3 font-medium">Stav</th>
              <th className="px-3 py-3 font-medium">Odevzdáno</th>
              <th
                className="px-3 py-3 text-center font-medium"
                title="Verze nahrané tímto studentem / celkem za jednotku"
              >
                Verze
              </th>
              <th className="px-3 py-3 text-center font-medium">Známka</th>
              <th className="w-10 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-4 text-center">
      <p className="font-display text-2xl font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
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
      <td className="px-4 py-2.5">
        <Link
          to="/subjects/$slug/assignments/$aid"
          params={{ slug, aid: row.assignmentId }}
          className="font-medium hover:underline"
        >
          {row.title}
        </Link>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {TARGET_LABEL[row.targetType]} · termín {formatDate(row.dueAt)}
        </span>
      </td>
      <td className="px-3 py-2.5">{statusChip}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        {row.submittedAt ? formatDateTime(row.submittedAt) : "—"}
      </td>
      <td className="px-3 py-2.5 text-center text-xs">
        <span className="font-semibold">{row.myUploads}</span>
        <span className="text-muted-foreground"> / {row.versions}</span>
      </td>
      <td className="px-3 py-2.5 text-center">
        {row.grade ? (
          <span className="inline-flex rounded-full bg-subject-soft px-2.5 py-0.5 text-sm font-bold ring-1 ring-subject/30">
            {row.grade}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm text-sm">
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
    </div>
  );
}
