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
  Upload,
  Download,
} from "lucide-react";
import { requireStaff } from "@/lib/guards";
import { ModalBackdrop } from "@/components/modal-backdrop";
import { getAdminData } from "@/lib/data";
import {
  createUser,
  updateUser,
  deleteUser,
  setUserPassword,
  bulkCreateUsers,
} from "@/lib/actions";
import { ROLES, roleLabel, type Role } from "@/lib/roles";
import { useUser } from "@/lib/use-user";
import type { AdminData, AdminUserRow } from "@/lib/types";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";
import { PageShell } from "@/components/page-shell";
import { PasswordReveal } from "@/components/password-reveal";
import { formatDateTime } from "@/lib/format";
import { downloadTextFile } from "@/lib/download";
import { INITIAL_PASSWORD } from "@/lib/constants";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context }) => {
    requireStaff(context.user);
  },
  loader: () => getAdminData(),
  head: () => ({
    meta: [{ title: "Správa — Shtroodle" }],
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
        <div className="space-y-8 min-w-0">
          <UsersSection users={data.users} classes={data.classes} />
        </div>

        <div className="space-y-8 min-w-0">
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
  const { confirm } = useDialog();
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
    const ok = await confirm({
      title: `Resetovat heslo pro ${u.name}?`,
      message: `Heslo se nastaví na sdílené výchozí heslo (${INITIAL_PASSWORD}) a uživatel si ho bude muset při příštím přihlášení změnit na vlastní.`,
    });
    if (!ok) return;
    await resetPw({ data: { id: u.id } });
    toast.success(`Heslo pro ${u.name} bylo resetováno na výchozí.`);
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
      <BulkCreateUsers classes={classes} />

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
  const [reveal, setReveal] = useState<{ name: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await create({
        data: {
          ...form,
          classId: form.role === "STUDENT" && form.classId ? form.classId : null,
        },
      });
      const name = `${form.firstName} ${form.lastName}`;
      setForm({ ...form, firstName: "", lastName: "", email: "" });
      await router.invalidate();
      setReveal({ name });
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
        Nový účet dostane sdílené výchozí heslo a musí si ho při prvním přihlášení změnit.
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
          password={INITIAL_PASSWORD}
          onClose={() => setReveal(null)}
        />
      )}
    </form>
  );
}

type BulkCreateResult = {
  created: { name: string; email: string; password: string }[];
  skipped: { line: string; reason: string }[];
};

/** Paste a class list, one person per line, and create all the accounts at once. */
function BulkCreateUsers({ classes }: { classes: AdminData["classes"] }) {
  const router = useRouter();
  const bulkCreate = useServerFn(bulkCreateUsers);
  const activeClasses = classes.filter((c) => !c.isArchived);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("STUDENT");
  const [classId, setClassId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkCreateResult | null>(null);

  const lineCount = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean).length;

  const closeAll = () => {
    setOpen(false);
    setResult(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await bulkCreate({
        data: { role, classId: role === "STUDENT" ? classId || null : null, text },
      });
      await router.invalidate();
      setResult(res);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hromadné vytvoření selhalo.");
    } finally {
      setBusy(false);
    }
  };

  const copyAll = async () => {
    if (!result) return;
    const lines = result.created.map((u) => `${u.name}\t${u.email}\t${u.password}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Přihlašovací údaje zkopírovány.");
    } catch {
      toast.error("Kopírování selhalo — opište údaje ručně.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-surface px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground cursor-pointer"
      >
        <Users className="h-4 w-4" /> Hromadně přidat účty
      </button>

      {open && !result && (
        <Modal title="Hromadně přidat účty" onClose={closeAll}>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-muted-foreground">
                Role
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className={`${inputCls} mt-1 w-full`}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
              {role === "STUDENT" ? (
                <label className="block text-xs font-semibold text-muted-foreground">
                  Třída
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    required
                    className={`${inputCls} mt-1 w-full`}
                  >
                    <option value="">Vyberte třídu</option>
                    {activeClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.schoolYear})
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span />
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="bulk-users-text"
                className="text-xs font-semibold text-muted-foreground"
              >
                Seznam osob (jeden na řádek)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      "vzor-hromadne-pridani-uctu.csv",
                      "Anna Nováková\n" +
                        "Petr Kovář; petr.kovar@shtroodle.cz\n" +
                        "Jana Svobodová\n",
                      "text/plain",
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Stáhnout vzorový soubor — použijte jako předlohu, např. pro AI převod vlastních dat do tohoto formátu"
                >
                  <Download className="h-3.5 w-3.5" /> Vzorový soubor
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Upload className="h-3.5 w-3.5" /> Nahrát soubor (.csv/.txt)
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setText((ev.target?.result as string) || "");
                        toast.success(`Soubor ${file.name} načten.`);
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <div>
              <textarea
                id="bulk-users-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
                rows={8}
                placeholder={"Anna Nováková\nPetr Kovář; petr.kovar@shtroodle.cz\nJana Svobodová"}
                className={`${inputCls} mt-1 w-full font-mono text-xs`}
              />
              <span className="mt-1 block text-[11px] font-normal normal-case text-muted-foreground">
                Formát: „Jméno Příjmení" nebo „Jméno Příjmení; email". Email lze vynechat —
                vygeneruje se automaticky.
                {lineCount > 0 &&
                  ` ${lineCount} ${lineCount === 1 ? "řádek" : lineCount < 5 ? "řádky" : "řádků"}.`}
              </span>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="mt-3 flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={closeAll}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                Storno
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 cursor-pointer"
              >
                {busy ? "Vytvářím…" : "Vytvořit účty"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {result && (
        <Modal title="Hromadně vytvořené účty" onClose={closeAll}>
          <div className="grid gap-4">
            {result.created.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    Vytvořeno ({result.created.length})
                  </p>
                  <button
                    type="button"
                    onClick={copyAll}
                    className="text-xs font-medium text-subject hover:underline cursor-pointer"
                  >
                    Kopírovat vše
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 border-b border-border bg-muted/40 text-left text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">Jméno</th>
                        <th className="px-2 py-1.5 font-medium">Email</th>
                        <th className="px-2 py-1.5 font-medium">Heslo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {result.created.map((u) => (
                        <tr key={u.email}>
                          <td className="px-2 py-1.5 font-medium">{u.name}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{u.email}</td>
                          <td className="mono px-2 py-1.5 font-semibold">{u.password}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Hesla se zobrazí jen teď — předejte je žákům. Později lze nastavit nové na kartě
                  žáka.
                </p>
              </div>
            )}
            {result.skipped.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-red-600">
                  Přeskočeno ({result.skipped.length})
                </p>
                <ul className="space-y-1 rounded-md border border-red-200 bg-red-50/40 p-2 text-xs dark:border-red-900/30 dark:bg-red-950/10">
                  {result.skipped.map((s, i) => (
                    <li key={i}>
                      <span className="font-mono">{s.line}</span> —{" "}
                      <span className="text-red-600">{s.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.created.length === 0 && result.skipped.length === 0 && (
              <p className="text-sm text-muted-foreground">Žádné řádky ke zpracování.</p>
            )}
            <div className="flex justify-end border-t border-border pt-4">
              <button
                type="button"
                onClick={closeAll}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
              >
                Hotovo
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
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
