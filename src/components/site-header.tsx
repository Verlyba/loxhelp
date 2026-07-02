import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ShieldCheck,
  UserCircle2,
  Menu,
  X,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { isStaff, roleLabel, type Role } from "@/lib/roles";
import { useUser } from "@/lib/use-user";
import { initials, fullName } from "@/lib/user-display";
import { logout } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const nav = [
  { to: "/", label: "Přehled", icon: LayoutDashboard, roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { to: "/subjects", label: "Předměty", icon: BookOpen, roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { to: "/classes", label: "Třídy", icon: Users, roles: ["ADMIN", "TEACHER"] },
  { to: "/admin", label: "Správa", icon: ShieldCheck, roles: ["ADMIN", "TEACHER"] },
] as const satisfies ReadonlyArray<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
}>;

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useUser();
  const [open, setOpen] = useState(false);

  const items = user
    ? nav.filter((item) => (item.roles as readonly Role[]).includes(user.role))
    : [];
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="mx-auto flex h-14 max-w-[120rem] items-center gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 font-display text-base font-semibold tracking-tight"
        >
          <span className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background text-[11px] font-bold">
            ŠK
          </span>
          Školka
        </Link>

        <nav className="ml-4 hidden md:flex items-center gap-1">
          {items.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <UserMenu />
              <button
                type="button"
                aria-label="Menu"
                onClick={() => setOpen((v) => !v)}
                className="md:hidden rounded-md p-2 hover:bg-accent"
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Přihlásit se
            </Link>
          )}
        </div>
      </div>

      {open && user && (
        <div className="md:hidden border-t border-border bg-surface">
          <div className="mx-auto max-w-[120rem] px-4 py-2 grid gap-1">
            {items.map((item) => {
              const active = isActive(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground"
            >
              <UserCircle2 className="h-4 w-4" />
              Můj účet
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function UserMenu() {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full border border-border bg-background/60 px-2 py-1 pr-2.5 text-sm hover:bg-accent/60 transition-colors">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-foreground text-background text-[10px] font-semibold">
            {initials(user)}
          </span>
          <span className="hidden sm:inline text-muted-foreground">
            {isStaff(user.role) ? roleLabel(user.role) : fullName(user)}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-sm font-medium">{fullName(user)}</span>
          <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account" className="flex items-center gap-2">
            <UserCircle2 className="h-4 w-4" /> Můj účet
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={handleLogout}
          className="flex items-center gap-2 text-destructive"
        >
          <LogOut className="h-4 w-4" /> Odhlásit se
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
