import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Plus,
  UserPlus,
  Pencil,
  Trash2,
  KeyRound,
  Search,
  X,
  History,
  ShieldAlert,
  Users,
} from "lucide-react";
import { requireStaff } from "@/lib/guards";
import { getAdminData } from "@/lib/data";
import { createUser, updateUser, deleteUser, setUserPassword } from "@/lib/actions";
import { ROLES, roleLabel, type Role } from "@/lib/roles";
import { useUser } from "@/lib/use-user";
import type { AdminData, AdminUserRow } from "@/lib/types";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";
import { PageShell } from "@/components/page-shell";
import { PasswordReveal } from "@/components/password-reveal";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context }) => {
    requireStaff(context.user);
  },
  loader: () => getAdminData(),
  head: () => ({
    meta: [{ title: "Správa — Školka" }],
  }),
  component: AdminPage,
});

const inputCls =
  "rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40";

function AdminPage() {
  const data = Route.useLoaderData() as AdminData;

  return (
    <PageShell
      eyebrow="Administrace"
      title="Správa"
      subtitle="Uživatelé, přehled a auditní stopa. Kliknutím na žáka otevřete jeho kartu."
      wide
    >
      {/* Quick stats strip */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Celkem uživatelů" value={data.users.length} />
        <StatCard label="Celkem předmětů" value={data.subjects.length} />
        <StatCard label="Celkem tříd" value={data.classes.length} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[5fr_4fr]">
        <div className="space-y-8">
          <UsersSection users={data.users} classes={data.classes} />
        </div>

        <div className="space-y-8">
          <AuditLogSection logs={data.auditLogs} />
        </div>
      </div>
    </PageShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

/* ================= users ================= */

function UsersSection({
  users,
  classes,
}: {
  users: AdminUserRow[];
  classes: AdminData["classes"];
}) {
  const me = useUser();
  const router = useRouter();
  const { confirm, prompt } = useDialog();
  const del = useServerFn(deleteUser);
  const resetPw = useServerFn(setUserPassword);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AdminUserRow | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.className ?? "").toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q),
      )
    : users;

  const handleDelete = async (u: AdminUserRow) => {
    const ok = await confirm({
      title: `Smazat účet ${u.name}?`,
      message: `${u.email}\nSmažou se i jeho zápisy, odevzdání a známky. Akce je nevratná.`,
      danger: true,
    });
    if (!ok) return;
    try {
      await del({ data: u.id });
      await router.invalidate();
      toast.success(`Účet ${u.name} smazán.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smazání selhalo.");
    }
  };

  const handleResetPw = async (u: AdminUserRow) => {
    const pw = await prompt({
      title: `Nové heslo pro ${u.name}`,
      message: "Minimálně 4 znaky. Student se s ním přihlásí a může si ho změnit.",
      defaultValue: "heslo123",
      confirmLabel: "Nastavit heslo",
    });
    if (!pw) return;
    if (pw.length < 4) {
      toast.error("Heslo must mít alespoň 4 znaky.");
      return;
    }
    await resetPw({ data: { id: u.id, password: pw } });
    toast.success(`Heslo pro ${u.name} nastaveno.`);
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
          <Users className="h-5 w-5 text-subject" /> Uživatelé ({users.length})
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat jméno, email, roli…"
            className={`${inputCls} !py-1.5 pl-8 w-56`}
          />
        </div>
      </div>

      <div className="surface-card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-border text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Jméno</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Třída</th>
              <th className="px-4 py-2.5 text-right font-medium">Akce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-accent/40">
                <td className="px-4 py-2 font-medium">
                  {u.role === "STUDENT" ? (
                    <Link
                      to="/students/$sid"
                      params={{ sid: u.id }}
                      title="Otevřít kartu žáka"
                      className="hover:text-subject hover:underline"
                    >
                      {u.name}
                    </Link>
                  ) : (
                    u.name
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      u.role === "STUDENT"
                        ? "bg-muted text-muted-foreground"
                        : "bg-subject-soft ring-1 ring-subject/30"
                    }`}
                  >
                    {roleLabel(u.role)}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{u.className ?? "—"}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-0.5">
                    <IconBtn title="Upravit" onClick={() => setEditing(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn title="Nastavit heslo" onClick={() => handleResetPw(u)}>
                      <KeyRound className="h-3.5 w-3.5" />
                    </IconBtn>
                    {me?.id !== u.id && (
                      <IconBtn title="Smazat" danger onClick={() => handleDelete(u)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconBtn>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Nikdo neodpovídá hledání „{query}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateUser classes={classes} />

      {editing && (
        <EditUserModal user={editing} classes={classes} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}

function IconBtn({
  title,
  danger = false,
  onClick,
  children,
}: {
  title: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`rounded-md p-1.5 transition-colors cursor-pointer ${
        danger
          ? "text-muted-foreground hover:bg-red-50 hover:text-red-600"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
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
    </div>
  );
}

function EditUserModal({
  user,
  classes,
  onClose,
}: {
  user: AdminUserRow;
  classes: AdminData["classes"];
  onClose: () => void;
}) {
  const router = useRouter();
  const update = useServerFn(updateUser);
  const [form, setForm] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    classId: user.classId,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await update({
        data: {
          id: user.id,
          ...form,
          classId: form.role === "STUDENT" ? form.classId : null,
        },
      });
      await router.invalidate();
      toast.success("Údaje uživatele uloženy.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uložení selhalo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Upravit: ${user.name}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-muted-foreground">
            Jméno
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
              className={`${inputCls} mt-1 w-full`}
            />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            Příjmení
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
              className={`${inputCls} mt-1 w-full`}
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
            className={`${inputCls} mt-1 w-full`}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-muted-foreground">
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              className={`${inputCls} mt-1 w-full`}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </label>
          {form.role === "STUDENT" && (
            <label className="block text-xs font-semibold text-muted-foreground">
              Třída
              <select
                value={form.classId ?? ""}
                onChange={(e) => setForm({ ...form, classId: e.target.value || null })}
                className={`${inputCls} mt-1 w-full`}
              >
                <option value="">Bez třídy</option>
                {classes
                  .filter((c) => !c.isArchived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.schoolYear})
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="mt-3 flex justify-end gap-3 border-t border-border pt-4">
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
            {busy ? "Ukládám…" : "Uložit změny"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateUser({ classes }: { classes: AdminData["classes"] }) {
  const router = useRouter();
  const create = useServerFn(createUser);
  const activeClasses = classes.filter((c) => !c.isArchived);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "STUDENT" as Role,
    classId: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ name: string; password: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await create({
        data: {
          ...form,
          classId: form.role === "STUDENT" && form.classId ? form.classId : null,
        },
      });
      const name = `${form.firstName} ${form.lastName}`;
      setForm({ ...form, firstName: "", lastName: "", email: "" });
      await router.invalidate();
      if (res.generatedPassword) {
        setReveal({ name, password: res.generatedPassword });
      } else {
        toast.success(`Uživatel ${name} vytvořen.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se vytvořit účet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface-card mt-4 grid gap-3 p-5">
      <h3 className="flex items-center gap-2 font-display font-semibold text-foreground">
        <UserPlus className="h-4.5 w-4.5 text-subject" /> Nový uživatel
      </h3>
      <p className="text-xs text-muted-foreground">
        Heslo se vygeneruje automaticky a po vytvoření jednou zobrazí.
      </p>
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
      <div className="grid grid-cols-2 gap-3">
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          className={inputCls}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
        {form.role === "STUDENT" ? (
          <select
            value={form.classId}
            onChange={(e) => setForm({ ...form, classId: e.target.value })}
            className={inputCls}
            required
          >
            <option value="">Vyberte třídu</option>
            {activeClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.schoolYear})
              </option>
            ))}
          </select>
        ) : (
          <span />
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={busy}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 cursor-pointer"
      >
        {busy ? "Ukládám…" : "Vytvořit účet"}
      </button>

      {reveal && (
        <PasswordReveal
          name={reveal.name}
          password={reveal.password}
          onClose={() => setReveal(null)}
        />
      )}
    </form>
  );
}

/* ================= Audit Log Section ================= */

function actionLabel(action: string): string {
  switch (action) {
    case "GRADE_SET":
      return "Zapsání známky";
    case "GRADE_CHANGE":
      return "Změna známky";
    case "GRADE_DELETE":
      return "Smazání známky";
    case "FEEDBACK_CHANGE":
      return "Změna zpětné vazby";
    case "SUBMISSION_LOCK":
      return "Uzamčení úkolu";
    case "SUBMISSION_UNLOCK":
      return "Odemčení úkolu";
    case "EXTENSION_SET":
      return "Prodloužení termínu";
    case "EXTENSION_CLEAR":
      return "Zrušení prodloužení";
    default:
      return action;
  }
}

function AuditLogSection({ logs }: { logs: AdminData["auditLogs"] }) {
  const [filterQuery, setFilterQuery] = useState("");

  const q = filterQuery.trim().toLowerCase();
  const filtered = q
    ? logs.filter(
        (l) =>
          l.actorName.toLowerCase().includes(q) ||
          l.targetName.toLowerCase().includes(q) ||
          actionLabel(l.action).toLowerCase().includes(q),
      )
    : logs;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
          <History className="h-5 w-5 text-subject" /> Historie kritických změn ({filtered.length})
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filtrovat logy…"
            className={`${inputCls} !py-1.5 pl-8 w-52`}
          />
        </div>
      </div>

      <div className="surface-card p-0 overflow-hidden">
        <div className="max-h-[640px] overflow-y-auto divide-y divide-border text-sm">
          {filtered.map((l) => (
            <div
              key={l.id}
              className="p-4 transition-colors hover:bg-accent/40 flex flex-col gap-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground">{l.actorName}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 text-xs">
                <span className="rounded bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                  {actionLabel(l.action)}
                </span>
                <span className="text-muted-foreground">pro</span>
                <span className="font-medium text-foreground">{l.targetName}</span>
              </div>
              {(l.oldValue !== null || l.newValue !== null) && (
                <div className="mt-1 bg-muted/30 border border-border/40 rounded p-1.5 text-xs font-mono flex items-center gap-2">
                  {l.oldValue !== null ? (
                    <>
                      <span className="text-red-600 line-through truncate max-w-[150px]">
                        {l.oldValue || "—"}
                      </span>
                      <span className="text-muted-foreground">→</span>
                    </>
                  ) : null}
                  <span className="text-green-600 font-semibold truncate max-w-[150px]">
                    {l.newValue || "—"}
                  </span>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
              <ShieldAlert className="h-8 w-8 text-muted-foreground/60" />
              <span>Žádné záznamy historie neodpovídají vyhledávání.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
