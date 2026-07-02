import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { login } from "@/lib/auth";
import { redirectIfAuthed } from "@/lib/guards";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ context }) => {
    redirectIfAuthed(context.user);
  },
  head: () => ({
    meta: [{ title: "Přihlášení — Školka" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const loginFn = useServerFn(login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await loginFn({ data: { email, password } });
      await router.invalidate();
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Přihlášení se nezdařilo.");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-md place-items-center px-4">
      <div className="surface-card w-full p-8">
        <h1 className="font-display text-2xl font-semibold">Vítejte zpět</h1>
        <p className="mt-1 text-sm text-muted-foreground">Přihlaste se ke svému účtu.</p>

        <form className="mt-6 grid gap-3" onSubmit={onSubmit}>
          <label className="text-sm">
            <span className="text-muted-foreground">Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              placeholder="vy@skola.cz"
              required
            />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Heslo</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              placeholder="••••••••"
              required
            />
          </label>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Přihlašuji…" : "Přihlásit se"}
          </button>
        </form>

        <div className="mt-6 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Demo účty (heslo: heslo123)</p>
          <p className="mt-1">učitel: novak@school.cz · admin: admin@school.cz</p>
          <p>student: anna@school.cz, marek@school.cz</p>
        </div>
      </div>
    </main>
  );
}
