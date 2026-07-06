import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileUp,
  ListTodo,
  Activity,
  ChevronRight,
  X,
} from "lucide-react";
import { getStudentPanel } from "@/lib/data";
import type { StudentTask, TaskStatus } from "@/lib/types";

const STATUS_META: Record<TaskStatus, { label: string; chip: string; icon: typeof Clock }> = {
  overdue: {
    label: "Po termínu",
    chip: "bg-red-50 text-red-700 ring-1 ring-red-200",
    icon: AlertTriangle,
  },
  pending: {
    label: "K odevzdání",
    chip: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    icon: Clock,
  },
  submitted: {
    label: "Odevzdáno",
    chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    icon: CheckCircle2,
  },
};

function dueLabel(iso: string) {
  const diff = Math.round((+new Date(iso) - Date.now()) / 86_400_000);
  if (diff < -1) return `před ${Math.abs(diff)} dny`;
  if (diff === -1) return "včera";
  if (diff === 0) return "dnes";
  if (diff === 1) return "zítra";
  return `za ${diff} dní`;
}

function useStudentPanel() {
  return useQuery({ queryKey: ["student-panel"], queryFn: () => getStudentPanel() });
}

/** Persistent right-hand panel for students: tasks on top, activity below. */
export function StudentPanel() {
  const { data, isLoading } = useStudentPanel();
  const tasks = data?.tasks ?? [];
  const activity = data?.recent ?? [];
  const todo = tasks.filter((t) => t.status !== "submitted");
  const done = tasks.filter((t) => t.status === "submitted");

  return (
    <div className="flex flex-col gap-5">
      <section className="surface-card p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <ListTodo className="h-4 w-4 text-subject" />
            Moje úkoly
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {done.length}/{tasks.length} hotovo
          </span>
        </header>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Načítám…</p>
        ) : todo.length === 0 ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-4 text-center text-sm text-emerald-700 ring-1 ring-emerald-200">
            🎉 Hotovo — nic k odevzdání.
          </p>
        ) : (
          <ul className="space-y-2">
            {todo.map((t) => (
              <TaskRow key={t.assignmentId} task={t} />
            ))}
          </ul>
        )}

        {done.length > 0 && (
          <details className="mt-3 group">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
              Odevzdané ({done.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {done.map((t) => (
                <TaskRow key={t.assignmentId} task={t} muted />
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="surface-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
          <Activity className="h-4 w-4 text-subject" />
          Poslední aktivita
        </h2>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Zatím žádné nahrané soubory.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.assignmentId + a.version} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                  <FileUp className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    <span className="mono text-xs text-muted-foreground">v{a.version}</span>{" "}
                    {a.fileName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.unitName} · {a.uploadedByName}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Below xl: a floating button with the pending count opens the panel as a drawer. */
export function StudentPanelDrawer() {
  const { data } = useStudentPanel();
  const [open, setOpen] = useState(false);
  const pending = (data?.tasks ?? []).filter((t) => t.status !== "submitted").length;

  return (
    <div className="xl:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Otevřít moje úkoly"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-foreground px-4 py-3 text-background shadow-[var(--shadow-elevated)] transition-transform active:translate-y-px"
      >
        <ListTodo className="h-5 w-5" />
        <span className="text-sm font-medium">Úkoly</span>
        {pending > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
            {pending}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
          />
          <div className="absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col overflow-y-auto bg-background p-4 shadow-[var(--shadow-elevated)]">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-base font-semibold">Můj panel</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Zavřít"
                className="rounded-md p-2 hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <StudentPanel />
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, muted = false }: { task: StudentTask; muted?: boolean }) {
  const meta = STATUS_META[task.status];
  const Icon = meta.icon;
  return (
    <li>
      <Link
        to="/subjects/$slug/assignments/$aid"
        params={{ slug: task.subjectSlug, aid: task.assignmentId }}
        className={`block rounded-lg border border-border p-2.5 transition-colors hover:bg-accent/60 ${
          muted ? "opacity-70" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{task.title}</span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}
          >
            <Icon className="h-3 w-3" />
            {meta.label}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{task.subjectName}</span>
          <span className={task.status === "overdue" ? "text-red-600" : ""}>
            {dueLabel(task.dueAt)}
          </span>
        </div>
      </Link>
    </li>
  );
}
