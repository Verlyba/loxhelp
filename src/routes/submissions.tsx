import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ChevronRight, Inbox, CheckCircle2, ChevronDown, CalendarClock } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { getSubmissionHub } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { downloadIcs } from "@/lib/ics";
import { TARGET_LABEL, type HubCourse, type HubItem, type TaskStatus } from "@/lib/types";

export const Route = createFileRoute("/submissions")({
  beforeLoad: ({ context }) => {
    const user = requireUser(context.user);
    if (user.role !== "STUDENT") throw redirect({ to: "/" });
  },
  loader: () => getSubmissionHub(),
  head: () => ({
    meta: [{ title: "Odevzdávárna — Shtroodle" }],
  }),
  component: SubmissionHub,
});

const STATUS_CHIP: Record<TaskStatus, { label: string; cls: string }> = {
  overdue: {
    label: "Po termínu",
    cls: "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/20 dark:text-red-400 dark:ring-red-900/30",
  },
  pending: {
    label: "K odevzdání",
    cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:ring-amber-900/30",
  },
  submitted: {
    label: "Odevzdáno",
    cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:ring-emerald-900/30",
  },
};

function SubmissionHub() {
  const courses = Route.useLoaderData() as HubCourse[];
  const totalMissing = courses.reduce((n, c) => n + c.missing.length, 0);
  const totalItems = courses.reduce((n, c) => n + c.missing.length + c.done.length, 0);

  return (
    <PageShell
      eyebrow="Vše na jednom místě"
      title="Odevzdávárna"
      subtitle={
        totalMissing === 0
          ? "Vše odevzdáno — nic tu na tebe nečeká. 🎉"
          : `Čeká na tebe ${totalMissing} ${totalMissing === 1 ? "úkol" : totalMissing < 5 ? "úkoly" : "úkolů"} v aktivních kurzech.`
      }
      actions={
        totalItems > 0 ? (
          <button
            type="button"
            onClick={() => downloadIcs(courses, "terminy_ukolu.ics")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/60 transition-colors"
          >
            <CalendarClock className="h-3.5 w-3.5" /> Export do kalendáře (.ics)
          </button>
        ) : undefined
      }
    >
      {courses.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          Nejste zapsáni v žádném aktivním kurzu.
        </p>
      ) : (
        <div className="grid gap-6">
          {courses.map((c) => (
            <section
              key={c.subjectId}
              data-subject-theme={c.theme}
              className="surface-card overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border bg-subject-soft/40 px-5 py-3.5">
                <Link
                  to="/subjects/$slug"
                  params={{ slug: c.slug }}
                  className="flex items-center gap-2 font-display font-semibold hover:underline text-foreground"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-subject" />
                  {c.name}
                </Link>
                <span className="text-xs font-semibold text-muted-foreground">
                  {c.missing.length === 0 ? "vše odevzdáno" : `chybí ${c.missing.length}`}
                </span>
              </div>

              <div className="p-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm border-collapse">
                  <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/10">
                    <tr>
                      <th className="px-4 py-3 font-semibold border-b border-border text-left">
                        <span className="block text-foreground font-bold tracking-normal normal-case text-xs">
                          Úkol
                        </span>
                        <span className="block text-[9px] text-muted-foreground font-normal normal-case mt-0.5">
                          Název úkolu
                        </span>
                      </th>
                      <th className="px-3 py-3 font-semibold border-b border-border text-left">
                        <span className="block text-foreground font-bold tracking-normal normal-case text-xs">
                          Typ odevzdání
                        </span>
                        <span className="block text-[9px] text-muted-foreground font-normal normal-case mt-0.5">
                          Jednotlivec / Skupina
                        </span>
                      </th>
                      <th className="px-3 py-3 text-center font-semibold border-b border-border">
                        <span className="block text-foreground font-bold tracking-normal normal-case text-xs">
                          Známka
                        </span>
                        <span className="block text-[9px] text-muted-foreground font-normal normal-case mt-0.5">
                          Hodnocení
                        </span>
                      </th>
                      <th className="px-3 py-3 font-semibold border-b border-border text-left">
                        <span className="block text-foreground font-bold tracking-normal normal-case text-xs">
                          Termín odevzdání
                        </span>
                        <span className="block text-[9px] text-muted-foreground font-normal normal-case mt-0.5">
                          Vypršení termínu
                        </span>
                      </th>
                      <th className="px-3 py-3 text-right font-semibold border-b border-border">
                        <span className="block text-foreground font-bold tracking-normal normal-case text-xs">
                          Stav
                        </span>
                        <span className="block text-[9px] text-muted-foreground font-normal normal-case mt-0.5">
                          Aktuální fáze
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {c.missing.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-5 text-sm text-emerald-700 font-semibold bg-emerald-50/5"
                        >
                          <span className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Všechny aktivní
                            úkoly jsou odevzdané!
                          </span>
                        </td>
                      </tr>
                    ) : (
                      c.missing.map((item) => <HubTableRow key={item.assignmentId} item={item} />)
                    )}
                  </tbody>
                </table>

                {c.done.length > 0 && (
                  <details className="group mt-4">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground mb-2 select-none">
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                      Zobrazit odevzdané ({c.done.length})
                    </summary>
                    <table className="w-full min-w-[640px] text-sm border-collapse mt-2 opacity-85">
                      <tbody className="divide-y divide-border/60 border-t border-border">
                        {c.done.map((item) => (
                          <HubTableRow key={item.assignmentId} item={item} muted />
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function HubTableRow({ item, muted = false }: { item: HubItem; muted?: boolean }) {
  const chip = STATUS_CHIP[item.status];
  return (
    <tr className={`transition-colors hover:bg-accent/40 ${muted ? "opacity-70" : ""}`}>
      <td className="px-4 py-3">
        <Link
          to="/subjects/$slug/assignments/$aid"
          params={{ slug: item.subjectSlug, aid: item.assignmentId }}
          className="flex items-center gap-2 font-semibold text-foreground hover:text-subject hover:underline text-sm"
        >
          <Inbox className="h-4 w-4 shrink-0 text-subject" />
          <span className="truncate">{item.title}</span>
        </Link>
      </td>
      <td className="px-3 py-3">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium border border-border">
          {TARGET_LABEL[item.targetType]}
        </span>
      </td>
      <td className="px-3 py-3 text-center">
        {item.grade ? (
          <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-subject-soft text-xs font-extrabold text-subject ring-1 ring-subject/20">
            {item.grade}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{formatDateTime(item.dueAt)}</td>
      <td className="px-3 py-3 text-right">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip.cls}`}
        >
          {chip.label}
        </span>
      </td>
    </tr>
  );
}
