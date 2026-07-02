import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, UserPlus, BookPlus } from "lucide-react";
import { requireStaff } from "@/lib/guards";
import { getAdminData } from "@/lib/data";
import { createUser, createSubject } from "@/lib/actions";
import { ROLES, roleLabel, type Role } from "@/lib/roles";
import type { AdminData } from "@/lib/types";

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

function AdminPage() {
  const data = Route.useLoaderData() as AdminData;

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">Administrace</p>
        <h1 className="text-3xl sm:text-4xl font-semibold">Správa</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Účty, předměty a třídy. Třídy spravujte na stránce{" "}
          <Link to="/classes" className="underline underline-offset-2">
            Třídy
          </Link>
          .
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-xl font-semibold mb-4">
            Uživatelé ({data.users.length})
          </h2>
          <div className="surface-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Jméno</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2 font-medium">{u.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {roleLabel(u.role)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CreateUser />
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold mb-4">
            Předměty ({data.subjects.length})
          </h2>
          <ul className="grid gap-3">
            {data.subjects.map((s) => (
              <li
                key={s.id}
                data-subject-theme={s.theme}
                className="surface-card flex items-center justify-between p-4"
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.className} · {s.schoolYear} · {s.studentCount} studentů
                  </p>
                </div>
                <span className="h-3 w-3 rounded-full bg-subject" />
              </li>
            ))}
          </ul>
          <CreateSubject classes={data.classes} />
        </section>
      </div>
    </main>
  );
}

function CreateUser() {
  const router = useRouter();
  const create = useServerFn(createUser);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "STUDENT" as Role,
    password: "heslo123",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await create({ data: form });
      setForm({ firstName: "", lastName: "", email: "", role: "STUDENT", password: "heslo123" });
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se vytvořit účet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface-card mt-4 p-5 grid gap-3">
      <h3 className="font-display font-semibold flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-subject" /> Nový uživatel
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <input
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          placeholder="Jméno"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
        <input
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          placeholder="Příjmení"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>
      <input
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        placeholder="Email"
        required
        className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
      <div className="grid grid-cols-2 gap-3">
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
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
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>
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
    <form onSubmit={submit} className="surface-card mt-4 p-5 grid gap-3">
      <h3 className="font-display font-semibold flex items-center gap-2">
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
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Popis (nepovinné)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
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
              className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            >
              <option value="default">Neutrální</option>
              <option value="loxone">Loxone (zelená)</option>
              <option value="cad3d">3D CAD (tmavá)</option>
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
