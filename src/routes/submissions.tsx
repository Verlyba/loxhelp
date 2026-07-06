import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ChevronRight, Inbox, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { getSubmissionHub } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { TARGET_LABEL, type HubCourse, type HubItem, type TaskStatus } from "@/lib/types";

export const Route = createFileRoute("/submissions")({
  beforeLoad: ({ context }) => {
    const user = requireUser(context.user);
    if (user.role !== "STUDENT") throw redirect({ to: "/" });
  },
  loader: () => getSubmissionHub(),
  head: () => ({
    meta: [{ title: "Odevzdávárna — Školka" }],
  }),
  component: SubmissionHub,
});

const STATUS_CHIP: Record<TaskStatus, { label: string; cls: string }> = {
  overdue: { label: "Po termínu", cls: "bg-red-50 text-red-700 ring-1 ring-red-200" },
  pending: { label: "K odevzdání", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  submitted: { label: "Odevzdáno", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
};

function SubmissionHub() {
  const courses = Route.useLoaderData() as HubCourse[];
  const totalMissing = courses.reduce((n, c) => n + c.missing.length, 0);

  return (
    <PageShell
      eyebrow="Vše na jednom místě"
      title="Odevzdávárna"
      subtitle={
        totalMissing === 0
          ? "Vše odevzdáno — nic tu na tebe nečeká. 🎉"
          : `Čeká na tebe ${totalMissing} ${totalMissing === 1 ? "úkol" : totalMissing < 5 ? "úkoly" : "úkolů"} v aktivních kurzech.`
      }
    >
      {courses.length === 0 ? (
        <p className="text-muted-foreground">Nejste zapsáni v žádném aktivním kurzu.</p>
      ) : (
        <div className="grid gap-6">
          {courses.map((c) => (
            <section
              key={c.subjectId}
              data-subject-theme={c.theme}
              className="surface-card overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border bg-subject-soft/40 px-5 py-3">
                <Link
                  to="/subjects/$slug"
                  params={{ slug: c.slug }}
                  className="flex items-center gap-2 font-display font-semibold hover:underline"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-subject" />
                  {c.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {c.missing.length === 0 ? "vše odevzdáno" : `chybí ${c.missing.length}`}
                </span>
              </div>

              <div className="p-4">
                {c.missing.length === 0 ? (
                  <p className="flex items-center gap-2 px-1 py-2 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Žádný úkol k odevzdání.
                  </p>
                ) : (
                  <ul className="grid gap-2">
                    {c.missing.map((item) => (
                      <HubRow key={item.assignmentId} item={item} />
                    ))}
                  </ul>
                )}

                {c.done.length > 0 && (
                  <details className="group mt-3">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                      Odevzdané ({c.done.length})
                    </summary>
                    <ul className="mt-2 grid gap-2">
                      {c.done.map((item) => (
                        <HubRow key={item.assignmentId} item={item} muted />
                      ))}
                    </ul>
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

/** One assignment row — fixed grid columns so values line up across rows. */
function HubRow({ item, muted = false }: { item: HubItem; muted?: boolean }) {
  const chip = STATUS_CHIP[item.status];
  return (
    <li>
      <Link
        to="/subjects/$slug/assignments/$aid"
        params={{ slug: item.subjectSlug, aid: item.assignmentId }}
        className={`grid items-center gap-2 rounded-lg border border-border p-3 transition-colors hover:bg-accent/60 sm:grid-cols-[minmax(0,1fr)_88px_44px_150px_110px] ${
          muted ? "opacity-70" : ""
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Inbox className="h-4 w-4 shrink-0 text-subject" />
          <span className="truncate font-medium">{item.title}</span>
        </span>
        <span className="hidden text-xs sm:block">
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {TARGET_LABEL[item.targetType]}
          </span>
        </span>
        <span className="hidden text-center text-xs sm:block">
          {item.grade ? (
            <span className="rounded-full bg-subject-soft px-2 py-0.5 font-bold ring-1 ring-subject/30">
              {item.grade}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:block">
          {formatDateTime(item.dueAt)}
        </span>
        <span className="text-right text-xs">
          <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${chip.cls}`}>
            {chip.label}
          </span>
        </span>
      </Link>
    </li>
  );
}
