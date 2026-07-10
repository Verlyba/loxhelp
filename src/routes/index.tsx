import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, FileUp, Users, Inbox, Clock, Bell, ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { getDashboard } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { useUser } from "@/lib/use-user";
import type { DashboardData, SubjectCard } from "@/lib/types";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    requireUser(context.user);
  },
  loader: () => getDashboard(),
  head: () => ({
    meta: [{ title: "Přehled — Školka" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const data = Route.useLoaderData() as DashboardData;
  return data.kind === "staff" ? <StaffDashboard data={data} /> : <StudentDashboard data={data} />;
}

function StaffDashboard({ data }: { data: Extract<DashboardData, { kind: "staff" }> }) {
  const user = useUser();
  return (
    <PageShell eyebrow="Dnešní přehled" title="Hlavní panel">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 sm:p-8 mb-8 shadow-soft">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 h-36 w-36 rounded-full bg-subject/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-subject select-none">
              {new Date().toLocaleDateString("cs-CZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Vítejte zpět, {user?.firstName ?? "vyučující"}! ☕
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
              Správa kurzů, hodnocení úkolů a dohled nad pokrokem studentů. Vše na jednom místě.
            </p>
          </div>
          <Link
            to="/subjects"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-all shadow-sm hover:shadow cursor-pointer"
          >
            Spravovat předměty <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        <Stat icon={BookOpen} label="Předměty" value={data.stats.subjects} color="text-blue-500 bg-blue-50 dark:bg-blue-950/20" />
        <Stat icon={Users} label="Aktivní třídy" value={data.stats.activeClasses} color="text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" />
        <Stat icon={FileUp} label="Úkoly" value={data.stats.assignments} color="text-orange-500 bg-orange-50 dark:bg-orange-950/20" />
        <Stat icon={Inbox} label="K hodnocení" value={data.stats.openSubmissions} color="text-purple-500 bg-purple-50 dark:bg-purple-950/20" />
      </div>

      {/* Main Grid */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 surface-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold font-display text-foreground">Vaše předměty</h2>
            <Link to="/subjects" className="text-xs font-semibold text-subject hover:underline">
              Zobrazit všechny
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.subjects.map((s) => (
              <SubjectTile key={s.id} subject={s} />
            ))}
          </div>
        </div>

        <div className="surface-card p-6 h-fit">
          <h2 className="text-lg font-bold font-display text-foreground mb-5">Poslední odevzdání</h2>
          {data.recentUploads.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Zatím nic nahráno.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {data.recentUploads.map((v) => {
                const initials = (v.uploadedByName[0] + (v.uploadedByName.split(" ").slice(-1)[0]?.[0] ?? ""))
                  .toUpperCase()
                  .slice(0, 2);
                return (
                  <li key={v.assignmentId + v.version} className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-subject-soft text-xs font-bold text-subject ring-1 ring-subject/20">
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/subjects/$slug/assignments/$aid"
                        params={{ slug: v.subjectSlug, aid: v.assignmentId }}
                        className="truncate font-semibold text-sm block hover:text-subject hover:underline text-foreground"
                      >
                        {v.fileName}
                      </Link>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {v.unitName} · {v.uploadedByName} · {formatDateTime(v.uploadedAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </PageShell>
  );
}

function StudentDashboard({ data }: { data: Extract<DashboardData, { kind: "student" }> }) {
  const user = useUser();
  const next = data.tasks.filter((t) => t.status !== "submitted").slice(0, 3);
  return (
    <PageShell eyebrow="Moje studium" title="Hlavní panel">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 sm:p-8 mb-8 shadow-soft">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 h-36 w-36 rounded-full bg-subject/10 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <span className="text-xs font-bold uppercase tracking-wider text-subject select-none">
            {new Date().toLocaleDateString("cs-CZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Ahoj, {user?.firstName ?? "studeňáku"}! 👋
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
            Tady je tvůj dnešní přehled. Podívej se, jaké úkoly tě čekají a co je nového ve tvých kurzech.
          </p>
        </div>
      </div>

      {/* What awaits you */}
      {next.length > 0 && (
        <div className="surface-card mb-8 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold font-display text-foreground">
            <Clock className="h-5 w-5 text-subject" /> Co tě čeká
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {next.map((t) => {
              const isOverdue = t.status === "overdue";
              return (
                <li key={t.assignmentId} className="h-full">
                  <Link
                    to="/subjects/$slug/assignments/$aid"
                    params={{ slug: t.subjectSlug, aid: t.assignmentId }}
                    className={`group flex flex-col justify-between h-full rounded-xl border p-4 bg-surface transition-all duration-300 hover:shadow-elevated hover:-translate-y-0.5 ${
                      isOverdue
                        ? "border-red-100 hover:border-red-300 hover:shadow-red-500/5 dark:border-red-950/40"
                        : "border-border/80 hover:border-subject/30 hover:shadow-subject/5"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                          {t.subjectName}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            isOverdue
                              ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                          }`}
                        >
                          {isOverdue ? "Po termínu" : "Čeká"}
                        </span>
                      </div>
                      <p className="mt-2 font-display font-semibold text-sm leading-snug text-foreground group-hover:text-subject transition-colors line-clamp-2">
                        {t.title}
                      </p>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground select-none">
                      <span className={isOverdue ? "text-red-600 font-medium dark:text-red-400" : ""}>
                        Termín: {new Date(t.dueAt).toLocaleDateString("cs-CZ")}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-subject group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Class Announcements */}
      {data.classNotifications && data.classNotifications.length > 0 && (
        <div className="surface-card mb-8 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold font-display text-foreground">
            <Bell className="h-5 w-5 text-subject animate-pulse" /> Důležitá oznámení třídy
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.classNotifications.map((n) => {
              const initials = (n.authorName[0] + (n.authorName.split(" ").slice(-1)[0]?.[0] ?? ""))
                .toUpperCase()
                .slice(0, 2);
              return (
                <div key={n.id} className="relative overflow-hidden rounded-xl border border-border bg-muted/5 p-5 shadow-sm hover:shadow transition-shadow">
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-subject-soft text-xs font-bold text-subject ring-1 ring-subject/20">
                      {initials}
                    </span>
                    <div>
                      <h4 className="font-semibold text-sm text-foreground truncate max-w-44 sm:max-w-xs">{n.title}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {n.authorName} · {new Date(n.createdAt).toLocaleDateString("cs-CZ")}
                      </p>
                    </div>
                  </div>
                  {n.body && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 whitespace-pre-line bg-surface/40 p-2.5 rounded-lg border border-border/40">
                      {n.body}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="mb-4 text-lg font-bold font-display text-foreground">Moje předměty</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.subjects.map((s) => (
          <SubjectTile key={s.id} subject={s} />
        ))}
      </div>
    </PageShell>
  );
}

function SubjectTile({ subject: s }: { subject: SubjectCard }) {
  const hasImage = !!s.imageUrl;
  return (
    <Link
      to="/subjects/$slug"
      params={{ slug: s.slug }}
      data-subject-theme={s.theme}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-all duration-300 hover:shadow-elevated hover:border-subject/30 h-full relative"
    >
      <div className="relative h-28 w-full overflow-hidden bg-muted flex-shrink-0">
        {hasImage ? (
          <img
            src={s.imageUrl!}
            alt={s.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-subject/20 to-subject/5" />
        )}
        <div className="subject-grid-bg absolute inset-0 opacity-40 pointer-events-none" />
        <span className="absolute top-2 left-2 bg-black/60 text-[9px] font-bold tracking-wider uppercase text-white rounded-full px-2 py-0.5 backdrop-blur-md border border-white/10 select-none">
          {s.className}
        </span>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-display text-base font-bold text-foreground group-hover:text-subject transition-colors line-clamp-1">
          {s.name}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-1 flex-1">
          {s.description || "Bez popisu předmětu."}
        </p>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground pt-2.5 border-t border-border select-none">
          <span>
            {s.studentCount} stud. · {s.assignmentCount} úkolů
          </span>
          <span className="text-subject font-bold opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
            Otevřít →
          </span>
        </div>
      </div>
    </Link>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="surface-card p-5 hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5 border border-border/80 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <span className="text-xs font-semibold text-muted-foreground block truncate">{label}</span>
        <p className="mt-1 text-2xl sm:text-3xl font-extrabold font-display leading-tight text-foreground">{value}</p>
      </div>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${color || "bg-muted text-muted-foreground"}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}
