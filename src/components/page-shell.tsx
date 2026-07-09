import type { ReactNode } from "react";
import { useUser } from "@/lib/use-user";
import { useRouterState } from "@tanstack/react-router";
import { StudentPanel } from "@/components/student-panel";

/**
 * Shared page frame — the same visual line as the course pages: a full-width
 * hero with the themed gradient wash and one consistent content container.
 * Every top-level page (Předměty, Třídy, Správa, Přehled, …) uses this so
 * widths, offsets and headers line up across the app.
 */
export function PageShell({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  wide = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** widen the container for dense tables (Správa) */
  wide?: boolean;
}) {
  const user = useUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isStudent = user?.role === "STUDENT";
  const inCourse = /^\/subjects\/[^/]+/.test(pathname);
  const showGlobalRail = isStudent && !inCourse;

  const container = wide ? "max-w-[88rem]" : "max-w-7xl";
  return (
    <>
      <div className="subject-hero border-b border-border">
        <div className={`mx-auto ${container} px-4 sm:px-6 py-8`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              {eyebrow && <p className="text-sm text-muted-foreground">{eyebrow}</p>}
              <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        </div>
      </div>
      <main className={`mx-auto ${container} px-4 sm:px-6 py-8`}>
        {showGlobalRail ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="min-w-0">{children}</div>
            <aside className="hidden xl:block">
              <div className="sticky top-[4.5rem]">
                <StudentPanel />
              </div>
            </aside>
          </div>
        ) : (
          children
        )}
      </main>
    </>
  );
}
