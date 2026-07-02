import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { useUser } from "@/lib/use-user";
import { initials, fullName } from "@/lib/user-display";
import { roleLabel } from "@/lib/roles";
import { logout } from "@/lib/auth";

export const Route = createFileRoute("/account")({
  beforeLoad: ({ context }) => {
    requireUser(context.user);
  },
  head: () => ({
    meta: [{ title: "Můj účet — Školka" }],
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

        <div className="mt-6 grid gap-3">
          <Field label="Jméno" value={user.firstName} />
          <Field label="Příjmení" value={user.lastName} />
          <Field label="Email" value={user.email} />
        </div>

        <button
          onClick={handleLogout}
          className="mt-6 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:border-destructive"
        >
          <LogOut className="h-4 w-4" /> Odhlásit se
        </button>
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        defaultValue={value}
        readOnly
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
    </label>
  );
}
