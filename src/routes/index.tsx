import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, FileUp, Users, Inbox, Clock } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { getDashboard } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
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
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-muted-foreground">Vítejte zpět</p>
          <h1 className="text-3xl sm:text-4xl font-semibold">Dnešní přehled</h1>
        </div>
        <Link
          to="/subjects"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Otevřít předměty <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        <Stat icon={BookOpen} label="Předměty" value={data.stats.subjects} />
        <Stat icon={Users} label="Aktivní třídy" value={data.stats.activeClasses} />
        <Stat icon={FileUp} label="Úkoly" value={data.stats.assignments} />
        <Stat icon={Inbox} label="Odevzdané skupiny" value={data.stats.openSubmissions} />
      </div>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 surface-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Vaše předměty</h2>
            <Link to="/subjects" className="text-sm text-muted-foreground hover:text-foreground">
              Vše
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.subjects.map((s) => (
              <SubjectTile key={s.id} subject={s} />
            ))}
          </div>
        </div>

        <div className="surface-card p-6">
          <h2 className="text-lg font-semibold mb-4">Poslední odevzdání</h2>
          {data.recentUploads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Zatím nic nahráno.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentUploads.map((v) => (
                <li key={v.assignmentId + v.version} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                    <FileUp className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{v.fileName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {v.unitName} · {v.uploadedByName} · {formatDateTime(v.uploadedAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function StudentDashboard({ data }: { data: Extract<DashboardData, { kind: "student" }> }) {
  const next = data.tasks.filter((t) => t.status !== "submitted").slice(0, 3);
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">Vítejte zpět</p>
        <h1 className="text-3xl sm:text-4xl font-semibold">Moje studium</h1>
      </div>

      {next.length > 0 && (
        <div className="surface-card mb-8 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5 text-subject" /> Co tě čeká
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {next.map((t) => (
              <li key={t.assignmentId}>
                <Link
                  to="/subjects/$slug/assignments/$aid"
                  params={{ slug: t.subjectSlug, aid: t.assignmentId }}
                  className="block rounded-xl border border-border p-4 hover:bg-accent/60"
                >
                  <p className="text-xs text-muted-foreground">{t.subjectName}</p>
                  <p className="mt-1 font-medium line-clamp-2">{t.title}</p>
                  <p
                    className={`mt-2 text-xs ${t.status === "overdue" ? "text-red-600" : "text-muted-foreground"}`}
                  >
                    {t.status === "overdue" ? "po termínu" : "termín"} {formatDateTime(t.dueAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-4 text-lg font-semibold">Moje předměty</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.subjects.map((s) => (
          <SubjectTile key={s.id} subject={s} />
        ))}
      </div>
    </main>
  );
}

function SubjectTile({ subject: s }: { subject: SubjectCard }) {
  return (
    <Link
      to="/subjects/$slug"
      params={{ slug: s.slug }}
      data-subject-theme={s.theme}
      className="group block rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-[var(--shadow-elevated)]"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-subject" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground mono">
          {s.className}
        </span>
      </div>
      <h3 className="font-display text-lg font-semibold">{s.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{s.description}</p>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {s.studentCount} studentů · {s.assignmentCount} úkolů
        </span>
        <span className="text-subject font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Otevřít →
        </span>
      </div>
    </Link>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-3xl font-semibold font-display">{value}</p>
    </div>
  );
}
