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
    </main>
  );
}
