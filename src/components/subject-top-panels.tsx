import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ClipboardList,
  Send,
  Upload,
  Users2,
  Megaphone,
  BarChart3,
} from "lucide-react";
import { uploadSubmission, setAssignmentPublished } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import {
  TARGET_LABEL,
  type StaffSubjectPanel,
  type StudentSubjectPanel,
  type TaskStatus,
} from "@/lib/types";

const STATUS_META: Record<TaskStatus, { label: string; cls: string; icon: typeof Clock }> = {
  overdue: {
    label: "Po termínu",
    cls: "bg-red-50 text-red-700 ring-1 ring-red-200",
    icon: AlertTriangle,
  },
  pending: {
    label: "K odevzdání",
    cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    icon: Clock,
  },
  submitted: {
    label: "Odevzdáno",
    cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    icon: CheckCircle2,
  },
};

/** Two static panels pinned in the course's right rail — student version. */
export function StudentTopPanels({
  panel,
  subjectSlug,
}: {
  panel: StudentSubjectPanel;
  subjectSlug: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <CurrentAssignmentPanel panel={panel} subjectSlug={subjectSlug} />
      <CourseStatusPanel panel={panel} subjectSlug={subjectSlug} />
    </div>
  );
}

function CurrentAssignmentPanel({
  panel,
  subjectSlug,
}: {
  panel: StudentSubjectPanel;
  subjectSlug: string;
}) {
  const router = useRouter();
  const uploadFn = useServerFn(uploadSubmission);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = panel.current;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Vyberte soubor.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("assignmentId", current.id);
      fd.set("file", file);
      await uploadFn({ data: fd });
      if (fileRef.current) fileRef.current.value = "";
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nahrání selhalo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="surface-card p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
        <ClipboardList className="h-4 w-4 text-subject" /> Aktuální úkol
      </h2>
      {!current ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-3 text-center text-sm text-emerald-700 ring-1 ring-emerald-200">
          🎉 Vše odevzdáno — žádný úkol nečeká.
        </p>
      ) : (
        <>
          <Link
            to="/subjects/$slug/assignments/$aid"
            params={{ slug: subjectSlug, aid: current.id }}
            className="mt-2 block rounded-lg border border-border p-3 transition-colors hover:bg-accent/60"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{current.title}</span>
              <StatusChip status={current.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {TARGET_LABEL[current.targetType]} · termín {formatDateTime(current.dueAt)}
            </p>
          </Link>
          <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" className="min-w-0 flex-1 text-xs" />
            <button
              disabled={busy}
              className="subject-button inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" /> {busy ? "Nahrávám…" : "Odevzdat"}
            </button>
          </form>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </>
      )}
    </section>
  );
}

function CourseStatusPanel({
  panel,
  subjectSlug,
}: {
  panel: StudentSubjectPanel;
  subjectSlug: string;
}) {
  const rest = panel.missing.filter((m) => m.id !== panel.current?.id);
  return (
    <section className="surface-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Send className="h-4 w-4 text-subject" /> Moje odevzdání
        </h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {panel.submittedCount}/{panel.publishedCount} hotovo
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {panel.myStudyGroup && (
          <span className="inline-flex items-center gap-1">
            <Users2 className="h-3.5 w-3.5" /> Skupina {panel.myStudyGroup}
          </span>
        )}
        {panel.myPair && (
          <span>
            {panel.myPair.name}
            {panel.myPair.partnerNames.length > 0 && ` s ${panel.myPair.partnerNames.join(", ")}`}
          </span>
        )}
      </div>

      {rest.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {rest.slice(0, 3).map((m) => (
            <li key={m.id}>
              <Link
                to="/subjects/$slug/assignments/$aid"
                params={{ slug: subjectSlug, aid: m.id }}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/60"
              >
                <span className="truncate">{m.title}</span>
                <StatusChip status={m.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {panel.recentGrades.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <p className="text-xs text-muted-foreground">Poslední známky</p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {panel.recentGrades.map((g, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate text-muted-foreground">{g.assignmentTitle}</span>
                <span className="rounded-full bg-subject-soft px-2 py-0.5 text-xs font-bold ring-1 ring-subject/30">
                  {g.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        to="/submissions"
        className="mt-3 inline-block text-xs font-medium text-subject underline underline-offset-2 hover:opacity-80"
      >
        Otevřít odevzdávárnu →
      </Link>
    </section>
  );
}

function StatusChip({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

/** Two static panels shown at the top of every course page — staff version. */
export function StaffTopPanels({
  panel,
  subjectSlug,
}: {
  panel: StaffSubjectPanel;
  subjectSlug: string;
}) {
  const router = useRouter();
  const publish = useServerFn(setAssignmentPublished);
  const [busyId, setBusyId] = useState<string | null>(null);

  const setPublished = async (id: string, isPublished: boolean) => {
    setBusyId(id);
    try {
      await publish({ data: { id, isPublished } });
      await router.invalidate();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="surface-card p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Megaphone className="h-4 w-4 text-subject" /> Nezadané úkoly
        </h2>
        {panel.unpublished.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Všechny úkoly jsou zadané. Nový přidáte na stránce Úkoly.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {panel.unpublished.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border px-2.5 py-1.5 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{a.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {TARGET_LABEL[a.targetType]} · {formatDateTime(a.dueAt)}
                  </span>
                </span>
                <button
                  onClick={() => setPublished(a.id, true)}
                  disabled={busyId === a.id}
                  className="subject-button shrink-0 !px-2.5 !py-1 text-xs disabled:opacity-60"
                >
                  {busyId === a.id ? "…" : "Zadat"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <BarChart3 className="h-4 w-4 text-subject" /> Odevzdání třídy
          </h2>
          <Link
            to="/subjects/$slug/overview"
            params={{ slug: subjectSlug }}
            className="text-xs font-medium text-subject underline underline-offset-2 hover:opacity-80"
          >
            Celý přehled →
          </Link>
        </div>
        {panel.published.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Zatím žádné zadané úkoly.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {panel.published.slice(0, 4).map((a) => {
              const pct =
                a.totalUnits > 0 ? Math.round((a.submittedUnits / a.totalUnits) * 100) : 0;
              return (
                <li key={a.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to="/subjects/$slug/assignments/$aid"
                      params={{ slug: subjectSlug, aid: a.id }}
                      className="truncate hover:underline"
                    >
                      {a.title}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {a.submittedUnits}/{a.totalUnits}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-subject" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
