import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { FileText, Pencil, X, Check, Plus, FileDown, FileSpreadsheet, Presentation, FileArchive, Loader2 } from "lucide-react";
import { updateSubjectPage, createAssignment, downloadCourseFile } from "@/lib/actions";
import { useUser } from "@/lib/use-user";
import { isStaff } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";
import type { AssignmentOverview, SubjectDetail, SubjectPageDetail, SubjectFileItem, TaskStatus } from "@/lib/types";

const subjectRoute = getRouteApi("/subjects/$slug");

/** Renders a subject page by its template. */
export function SubjectPageView({ page }: { page: SubjectPageDetail }) {
  if (page.template === "assignments") return <AssignmentsTemplate page={page} />;
  return <ContentPage page={page} />;
}

/* ---------- plain content page (markdown-lite) ---------- */

function ContentPage({ page }: { page: SubjectPageDetail }) {
  const user = useUser();
  const staff = !!user && isStaff(user.role);
  const [editing, setEditing] = useState(false);

  return (
    <article className="surface-card p-6 sm:p-8">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{page.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Aktualizováno {formatDateTime(page.updatedAt)}
          </p>
        </div>
        {staff && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" /> Upravit
          </button>
        )}
      </header>

      {editing ? (
        <PageEditor page={page} onDone={() => setEditing(false)} />
      ) : (
        <>
          {page.content.trim() ? (
            <MarkdownLite text={page.content} />
          ) : (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto mb-2 h-6 w-6" />
              Tahle stránka je zatím prázdná.
              {staff && " Klikněte na Upravit a napište obsah."}
            </p>
          )}

          {page.files && page.files.length > 0 && (
            <div className="mt-8 border-t border-border pt-6">
              <h3 className="font-display text-lg font-semibold mb-4 text-foreground">
                Pracovní soubory a podklady
              </h3>
              <FileGrid files={page.files} />
            </div>
          )}
        </>
      )}
    </article>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  presentation: "Prezentace",
  manual: "Manuál",
  schema: "Schéma",
  template: "Šablona",
  material: "Materiál",
};

const CATEGORY_COLORS: Record<string, string> = {
  presentation: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 ring-orange-200/50",
  manual: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 ring-blue-200/50",
  schema: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 ring-emerald-200/50",
  template: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 ring-purple-200/50",
  material: "bg-slate-50 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300 ring-slate-200/50",
};

function getFileMeta(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    return {
      icon: FileText,
      colorClass: "text-red-600 dark:text-red-400",
      bgClass: "bg-red-50 dark:bg-red-950/30",
      borderClass: "hover:border-red-300 hover:shadow-red-500/5 dark:hover:border-red-800",
    };
  }
  if (ext === "pptx" || ext === "ppt") {
    return {
      icon: Presentation,
      colorClass: "text-orange-600 dark:text-orange-400",
      bgClass: "bg-orange-50 dark:bg-orange-950/30",
      borderClass: "hover:border-orange-300 hover:shadow-orange-500/5 dark:hover:border-orange-800",
    };
  }
  if (ext === "docx" || ext === "doc") {
    return {
      icon: FileText,
      colorClass: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-blue-50 dark:bg-blue-950/30",
      borderClass: "hover:border-blue-300 hover:shadow-blue-500/5 dark:hover:border-blue-800",
    };
  }
  if (ext === "xls" || ext === "xlsx") {
    return {
      icon: FileSpreadsheet,
      colorClass: "text-emerald-600 dark:text-emerald-400",
      bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
      borderClass: "hover:border-emerald-300 hover:shadow-emerald-500/5 dark:hover:border-emerald-800",
    };
  }
  if (ext === "zip" || ext === "rar") {
    return {
      icon: FileArchive,
      colorClass: "text-purple-600 dark:text-purple-400",
      bgClass: "bg-purple-50 dark:bg-purple-950/30",
      borderClass: "hover:border-purple-300 hover:shadow-purple-500/5 dark:hover:border-purple-800",
    };
  }
  return {
    icon: FileText,
    colorClass: "text-slate-600 dark:text-slate-400",
    bgClass: "bg-slate-50 dark:bg-slate-900/40",
    borderClass: "hover:border-slate-300 hover:shadow-slate-500/5 dark:hover:border-slate-800",
  };
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function FileGrid({ files }: { files: SubjectFileItem[] }) {
  const download = useServerFn(downloadCourseFile);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (fileId: string) => {
    setDownloading(fileId);
    try {
      const res = await download({ data: fileId });
      const link = document.createElement("a");
      link.href = `data:${res.mimeType};base64,${res.dataBase64}`;
      link.download = res.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Chyba při stahování souboru:", err);
      alert("Soubor se nepodařilo stáhnout.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
      {files.map((file) => {
        const meta = getFileMeta(file.fileName);
        const Icon = meta.icon;
        const isDownloading = downloading === file.id;
        const ext = file.fileName.split(".").pop()?.toUpperCase() || "FILE";

        const helperText = file.description || "Doprovodné studijní materiály k lekci";

        return (
          <div
            key={file.id}
            onClick={() => !isDownloading && handleDownload(file.id)}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-surface/50 p-5 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md hover:border-subject/40 hover:-translate-y-0.5"
          >
            {/* Top row with details */}
            <div className="flex items-start gap-4">
              {/* Prominent File Icon and Extension Badge */}
              <div className="relative shrink-0 flex flex-col items-center">
                <div className={`grid h-14 w-14 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${meta.bgClass}`}>
                  <Icon className={`h-7 w-7 ${meta.colorClass}`} />
                </div>
                {/* Visual badge below icon */}
                <span className={`absolute -bottom-1.5 px-2 py-0.5 text-[9px] font-bold rounded-md shadow-sm border border-background text-white select-none
                  ${ext === "PDF" ? "bg-red-500" :
                    ext === "PPTX" || ext === "PPT" ? "bg-orange-500" :
                    ext === "DOCX" || ext === "DOC" ? "bg-blue-500" :
                    ext === "XLSX" || ext === "XLS" ? "bg-emerald-500" :
                    ext === "ZIP" || ext === "RAR" ? "bg-purple-500" : "bg-slate-500"
                  }
                `}>
                  {ext}
                </span>
              </div>

              {/* Text information */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ring-1 ring-border/50 ${CATEGORY_COLORS[file.category] || CATEGORY_COLORS.material}`}>
                    {CATEGORY_LABELS[file.category] || file.category}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {formatBytes(file.fileSize)}
                  </span>
                </div>
                <h4 className="mt-2 font-display font-bold text-base leading-snug text-foreground group-hover:text-subject transition-colors" title={file.label}>
                  {file.label}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1" title={file.fileName}>
                  Název souboru: {file.fileName}
                </p>
                <p className="mt-2 text-xs text-foreground/75 leading-normal">
                  {helperText}
                </p>
              </div>
            </div>

            {/* Bottom action row */}
            <div className="mt-5 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate max-w-[70%]">
                Kliknutím stáhnete soubor
              </span>
              <button
                type="button"
                disabled={isDownloading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-subject text-subject-foreground transition-all group-hover:brightness-105"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Stahuji...
                  </>
                ) : (
                  <>
                    <FileDown className="h-3.5 w-3.5" />
                    Stáhnout
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PageEditor({ page, onDone }: { page: SubjectPageDetail; onDone: () => void }) {
  const router = useRouter();
  const update = useServerFn(updateSubjectPage);
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await update({ data: { id: page.id, title, content } });
      await router.invalidate();
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 font-display text-lg font-semibold outline-none focus:ring-2 focus:ring-ring/40"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={14}
        placeholder={"# Nadpis\n\nOdstavec textu…\n\n## Podnadpis\n\n- odrážka\n- další odrážka"}
        className="mono rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/40"
      />
      <p className="text-xs text-muted-foreground">
        Podporuje jednoduché formátování: # nadpis, ## podnadpis, - odrážky, **tučně**.
      </p>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="subject-button inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          <Check className="h-4 w-4" /> {busy ? "Ukládám…" : "Uložit"}
        </button>
        <button
          onClick={onDone}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm"
        >
          <X className="h-4 w-4" /> Zrušit
        </button>
      </div>
    </div>
  );
}

/** Tiny renderer for the "plain program" pages: #/## headings, - lists, **bold**. */
function MarkdownLite({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key++} className="my-3 list-disc space-y-1 pl-6 text-[15px] leading-relaxed">
        {list.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={key++} className="mt-6 mb-2 font-display text-lg font-semibold">
          {inline(line.slice(3))}
        </h3>,
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={key++} className="mt-6 mb-3 font-display text-xl font-semibold first:mt-0">
          {inline(line.slice(2))}
        </h2>,
      );
    } else {
      blocks.push(
        <p key={key++} className="my-3 text-[15px] leading-relaxed text-foreground/90">
          {inline(line)}
        </p>,
      );
    }
  }
  flushList();
  return <div>{blocks}</div>;
}

/** Inline formatting: **bold** and [text](url) links. */
function inline(text: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*)|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) tokens.push(text.slice(last, m.index));
    if (m[1]) {
      tokens.push(<strong key={key++}>{m[1].slice(2, -2)}</strong>);
    } else {
      tokens.push(
        <a
          key={key++}
          href={m[3]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-subject underline underline-offset-2 hover:opacity-80"
        >
          {m[2]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push(text.slice(last));
  return tokens;
}

/* ---------- assignments template page ---------- */

const STATUS_CHIP: Record<TaskStatus, { label: string; cls: string }> = {
  overdue: { label: "Po termínu", cls: "bg-red-50 text-red-700 ring-1 ring-red-200" },
  pending: { label: "K odevzdání", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  submitted: { label: "Odevzdáno", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
};

function AssignmentsTemplate({ page }: { page: SubjectPageDetail }) {
  const subject = subjectRoute.useLoaderData() as SubjectDetail;
  const user = useUser();
  const staff = !!user && isStaff(user.role);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">{page.title}</h2>
        {staff && <CreateAssignment subjectId={subject.id} />}
      </div>
      {subject.assignments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Zatím žádné úkoly.
        </p>
      ) : (
        <ul className="grid gap-3">
          {subject.assignments.map((a) => (
            <li key={a.id}>
              <Link
                to="/subjects/$slug/assignments/$aid"
                params={{ slug: subject.slug, aid: a.id }}
                className="surface-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 transition-shadow hover:shadow-[var(--shadow-elevated)]"
              >
                <div className="min-w-0">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground line-clamp-1">{a.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <AssignmentBadge a={a} staff={staff} />
                  <span className="mono text-muted-foreground">{formatDateTime(a.dueAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CreateAssignment({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const create = useServerFn(createAssignment);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { subjectId, title, description, dueDate } });
      setTitle("");
      setDescription("");
      setDueDate("");
      setOpen(false);
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="subject-button inline-flex items-center gap-1.5"
      >
        <Plus className="h-4 w-4" /> Nový úkol
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="surface-card w-full grid gap-3 p-5">
      <h3 className="font-display font-semibold">Nový úkol</h3>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Název"
        required
        autoFocus
        className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Zadání"
        rows={3}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
      <input
        type="datetime-local"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        required
        className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
      <div className="flex gap-2">
        <button disabled={busy} className="subject-button flex-1 disabled:opacity-60">
          {busy ? "Ukládám…" : "Vytvořit"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
        >
          Zrušit
        </button>
      </div>
    </form>
  );
}

function AssignmentBadge({ a, staff }: { a: AssignmentOverview; staff: boolean }) {
  if (staff) {
    return (
      <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
        {a.submittedCount}/{a.groupCount} odevzdáno
      </span>
    );
  }
  if (!a.myStatus) return null;
  const chip = STATUS_CHIP[a.myStatus];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${chip.cls}`}>{chip.label}</span>
  );
}
