import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { LogOut, KeyRound, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { requireUser } from "@/lib/guards";
import { useUser } from "@/lib/use-user";
import { initials, fullName } from "@/lib/user-display";
import { roleLabel } from "@/lib/roles";
import { logout } from "@/lib/auth";
import { changeOwnPassword } from "@/lib/actions";

export const Route = createFileRoute("/account")({
  beforeLoad: ({ context }) => {
    requireUser(context.user);
  },
  head: () => ({
    meta: [{ title: "Můj účet — Shtroodle" }],
  }),
  component: AccountPage,
});

function AccountPage() {
  const user = useUser();
  const router = useRouter();
  const navigate = useNavigate();
  const logoutFn = useServerFn(logout);
  if (!user) return null;

  const handleLogout = async () => {
    await logoutFn();
    await router.invalidate();
    navigate({ to: "/auth" });
  };

  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-semibold">Můj účet</h1>

      {user.mustChangePassword && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Musíte si nastavit vlastní heslo</p>
            <p className="mt-0.5 text-xs text-amber-700">
              Tento účet ještě používá sdílené výchozí heslo. Dokud si nenastavíte vlastní, nemůžete
              používat zbytek aplikace.
            </p>
          </div>
        </div>
      )}

      <div className="surface-card mt-6 p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-foreground text-background font-display text-lg font-semibold">
            {initials(user)}
          </span>
          <div>
            <p className="font-display text-lg font-semibold">{fullName(user)}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs uppercase tracking-wider text-muted-foreground">
              {roleLabel(user.role)}
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-3 border-t border-border pt-6 text-sm">
          <div className="flex justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Jméno</span>
            <span className="font-medium text-foreground">{user.firstName}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Příjmení</span>
            <span className="font-medium text-foreground">{user.lastName}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium text-foreground">{user.email}</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="mt-6 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:border-destructive"
        >
          <LogOut className="h-4 w-4" /> Odhlásit se
        </button>
      </div>

      <ChangePasswordCard />
    </main>
  );
}

const inputCls =
  "rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40 w-full";

function ChangePasswordCard() {
  const router = useRouter();
  const changePassword = useServerFn(changeOwnPassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 4) {
      setError("Nové heslo musí mít alespoň 4 znaky.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Nová hesla se neshodují.");
      return;
    }
    setBusy(true);
    try {
      await changePassword({ data: { currentPassword, newPassword } });
      toast.success("Heslo bylo změněno.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Změna hesla selhala.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface-card mt-6 p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <KeyRound className="h-4.5 w-4.5 text-subject" /> Změnit heslo
      </h2>
      <form onSubmit={submit} className="mt-4 grid gap-3 max-w-sm">
        <label className="block text-xs font-semibold text-muted-foreground">
          Současné heslo
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          Nové heslo
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={4}
            autoComplete="new-password"
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          Nové heslo znovu
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={4}
            autoComplete="new-password"
            className={`${inputCls} mt-1`}
          />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-1 justify-self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 cursor-pointer"
        >
          {busy ? "Ukládám…" : "Změnit heslo"}
        </button>
      </form>
    </div>
  );
}
