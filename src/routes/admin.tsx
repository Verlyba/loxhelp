import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Plus,
  UserPlus,
  BookPlus,
  Pencil,
  Trash2,
  KeyRound,
  Search,
  Users,
  X,
  ClipboardPaste,
  ExternalLink,
  BarChart3,
  Users2,
} from "lucide-react";
import { requireStaff } from "@/lib/guards";
import { getAdminData } from "@/lib/data";
import {
  createUser,
  updateUser,
  deleteUser,
  setUserPassword,
  createSubject,
  updateSubject,
  deleteSubject,
} from "@/lib/actions";
import { ROLES, roleLabel, type Role } from "@/lib/roles";
import { useUser } from "@/lib/use-user";
import type { AdminData, AdminUserRow, SubjectCard } from "@/lib/types";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";

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
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">Administrace</p>
        <h1 className="text-3xl sm:text-4xl font-semibold">Správa</h1>
      </header>

      {/* Quick stats strip */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Uživatelů" value={data.users.length} />
        <StatCard label="Předmětů" value={data.subjects.length} />
        <StatCard label="Tříd" value={data.classes.length} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[3fr_2fr]">
        <UsersSection users={data.users} classes={data.classes} />

        <div className="space-y-8">
          <SubjectsSection subjects={data.subjects} classes={data.classes} />
          <ClassesSummary classes={data.classes} />
        </div>
      </div>
    </main>
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
  const [showImport, setShowImport] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.className ?? "").toLowerCase().includes(q),
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
      toast.error("Heslo musí mít alespoň 4 znaky.");
      return;
    }
    await resetPw({ data: { id: u.id, password: pw } });
    toast.success(`Heslo pro ${u.name} nastaveno.`);
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <Users className="h-5 w-5 text-subject" /> Uživatelé ({users.length})
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledat jméno, email, třídu…"
              className={`${inputCls} !py-1.5 pl-8 w-56`}
            />
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-accent"
          >
            <ClipboardPaste className="h-4 w-4" /> Import
          </button>
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
                <td className="px-4 py-2 font-medium">{u.name}</td>
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
      {showImport && <ImportStudentsModal classes={classes} onClose={() => setShowImport(false)} />}
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
      className={`rounded-md p-1.5 transition-colors ${
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
      await update({ data: { id: user.id, ...form } });
      await router.invalidate();
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
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Storno
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Ukládám…" : "Uložit změny"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Bulk import: one student per line — "Jméno Příjmení; email" or "Jméno Příjmení". */
function ImportStudentsModal({
  classes,
  onClose,
}: {
  classes: AdminData["classes"];
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
            className="justify-self-end rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Hotovo
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            Každý student na jeden řádek: <span className="mono">Jméno Příjmení; email</span>. Bez
            emailu se vygeneruje <span className="mono">jmeno.prijmeni@school.cz</span>.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"Jan Novotný; jan.novotny@school.cz\nEva Malá"}
            className={`${inputCls} mono w-full leading-relaxed`}
          />
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
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Vytvářím…" : `Vytvořit ${valid.length} účtů`}
            </button>
          </div>
        </div>
      )}
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
    password: "heslo123",
    classId: null as string | null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await create({ data: form });
      setForm({ ...form, firstName: "", lastName: "", email: "" });
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se vytvořit účet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface-card mt-4 grid gap-3 p-5">
      <h3 className="flex items-center gap-2 font-display font-semibold">
        <UserPlus className="h-4 w-4 text-subject" /> Nový uživatel
      </h3>
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
        <input
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="Heslo"
          required
          className={inputCls}
        />
      </div>
      {form.role === "STUDENT" && (
        <select
          value={form.classId ?? ""}
          onChange={(e) => setForm({ ...form, classId: e.target.value || null })}
          className={inputCls}
        >
          <option value="">Bez třídy</option>
          {activeClasses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.schoolYear})
            </option>
          ))}
        </select>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={busy}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Ukládám…" : "Vytvořit účet"}
      </button>
    </form>
  );
}

/* ================= subjects ================= */

function SubjectsSection({
  subjects,
  classes,
}: {
  subjects: SubjectCard[];
  classes: AdminData["classes"];
}) {
  const router = useRouter();
  const del = useServerFn(deleteSubject);
  const [editing, setEditing] = useState<SubjectCard | null>(null);
  const { confirm } = useDialog();

  const handleDelete = async (s: SubjectCard) => {
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
    <section>
      <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
        <BookPlus className="h-5 w-5 text-subject" /> Předměty ({subjects.length})
      </h2>
      <ul className="grid gap-3">
        {subjects.map((s) => (
          <li key={s.id} data-subject-theme={s.theme} className="surface-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to="/subjects/$slug"
                  params={{ slug: s.slug }}
                  className="font-medium hover:underline"
                >
                  {s.name}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.className} · {s.schoolYear} · {s.studentCount} studentů · {s.assignmentCount}{" "}
                  úkolů
                </p>
              </div>
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-subject" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3 text-xs">
              <Link
                to="/subjects/$slug"
                params={{ slug: s.slug }}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-accent"
              >
                <ExternalLink className="h-3 w-3" /> Otevřít
              </Link>
              <Link
                to="/subjects/$slug/groups"
                params={{ slug: s.slug }}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-accent"
              >
                <Users2 className="h-3 w-3" /> Skupiny
              </Link>
              <Link
                to="/subjects/$slug/overview"
                params={{ slug: s.slug }}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-accent"
              >
                <BarChart3 className="h-3 w-3" /> Přehled
              </Link>
              <span className="flex-1" />
              <IconBtn title="Upravit předmět" onClick={() => setEditing(s)}>
                <Pencil className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn title="Smazat předmět" danger onClick={() => handleDelete(s)}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconBtn>
            </div>
          </li>
        ))}
      </ul>

      <CreateSubject classes={classes} />

      {editing && <EditSubjectModal subject={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function EditSubjectModal({ subject, onClose }: { subject: SubjectCard; onClose: () => void }) {
  const router = useRouter();
  const update = useServerFn(updateSubject);
  const [form, setForm] = useState({
    name: subject.name,
    description: subject.description,
    themeStyle: subject.theme as "loxone" | "cad3d" | "default",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await update({ data: { id: subject.id, ...form } });
      await router.invalidate();
      onClose();
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

function CreateSubject({ classes }: { classes: AdminData["classes"] }) {
  const router = useRouter();
  const create = useServerFn(createSubject);
  const active = classes.filter((c) => !c.isArchived);
  const [form, setForm] = useState({
    name: "",
    description: "",
    themeStyle: "default" as "loxone" | "cad3d" | "default",
    classId: active[0]?.id ?? "",
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface-card mt-4 grid gap-3 p-5">
      <h3 className="flex items-center gap-2 font-display font-semibold">
        <BookPlus className="h-4 w-4 text-subject" /> Nový předmět
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
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              className={inputCls}
            >
              {active.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.schoolYear})
                </option>
              ))}
            </select>
            <select
              value={form.themeStyle}
              onChange={(e) =>
                setForm({ ...form, themeStyle: e.target.value as typeof form.themeStyle })
              }
              className={inputCls}
            >
              <option value="default">Neutrální</option>
              <option value="loxone">Loxone (zelená)</option>
              <option value="cad3d">3D CAD (modrá)</option>
            </select>
          </div>
          <button
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> {busy ? "Ukládám…" : "Vytvořit předmět"}
          </button>
        </>
      )}
    </form>
  );
}

/* ================= classes summary ================= */

function ClassesSummary({ classes }: { classes: AdminData["classes"] }) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
        <Users className="h-5 w-5 text-subject" /> Třídy ({classes.length})
      </h2>
      <div className="surface-card divide-y divide-border">
        {classes.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <span className="font-medium">{c.name}</span>{" "}
              <span className="text-muted-foreground">({c.schoolYear})</span>
              {c.isArchived && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  archiv
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {c.studentCount} studentů · {c.subjectCount} předmětů
            </span>
          </div>
        ))}
      </div>
      <Link
        to="/classes"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-subject underline underline-offset-2 hover:opacity-80"
      >
        Spravovat třídy a studenty <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
