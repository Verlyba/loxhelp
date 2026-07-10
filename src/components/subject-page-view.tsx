import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode, useRef } from "react";
import {
  FileText,
  Pencil,
  X,
  Check,
  Plus,
  FileDown,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  Loader2,
  Trash2,
  FolderOpen,
  Upload,
  Eye,
  EyeOff,
  BookOpen,
  Network,
  Layers,
} from "lucide-react";
import {
  updateSubjectPage,
  createAssignment,
  downloadCourseFile,
  uploadCourseFile,
  deleteCourseFile,
  updateCourseFile,
  setCourseFilePublished,
} from "@/lib/actions";
import { useUser } from "@/lib/use-user";
import { isStaff } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";
import {
  TARGET_LABEL,
  TARGET_TYPES,
  type AssignmentOverview,
  type SubjectDetail,
  type SubjectPageDetail,
  type SubjectFileItem,
  type TargetType,
  type TaskStatus,
} from "@/lib/types";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";

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
  const subject = subjectRoute.useLoaderData() as SubjectDetail;

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

          {/* Linked assignments list */}
          {(page.showAssignments || (staff && page.assignments && page.assignments.length > 0)) && (
            <div className="mt-8 border-t border-border pt-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Úkoly k odevzdání
                </h3>
                {staff && <CreateAssignment subjectId={subject.id} pageId={page.id} />}
              </div>
              {!page.assignments || page.assignments.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Zatím žádné úkoly pod touto stránkou.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {page.assignments.map((a) => (
                    <li key={a.id}>
                      <Link
                        to="/subjects/$slug/assignments/$aid"
                        params={{ slug: subject.slug, aid: a.id }}
                        className="surface-card grid items-center gap-3 p-5 transition-shadow hover:shadow-[var(--shadow-elevated)] sm:grid-cols-[minmax(0,1fr)_auto_150px]"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{a.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {a.description}
                          </p>
                        </div>
                        <div className="flex items-center justify-end text-sm">
                          <AssignmentBadge a={a} staff={staff} />
                        </div>
                        <span className="mono text-sm text-muted-foreground sm:text-right">
                          {formatDateTime(a.dueAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Staff: manage materials directly on the page (no need to open the editor) */}
          {staff && <MaterialsManager page={page} />}
        </>
      )}
    </article>
  );
}

/** Collapsible materials admin visible to staff right on the page. */
function MaterialsManager({ page }: { page: SubjectPageDetail }) {
  const [open, setOpen] = useState(page.files.length === 0);

  return (
    <div className="mt-8 rounded-xl border border-dashed border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent/40"
      >
        <span className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-subject" />
          Spravovat materiály ({page.files.length})
        </span>
        <span className="text-xs font-normal text-muted-foreground">
          {open ? "skrýt" : "přidat / upravit / smazat"}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border p-4">
          {page.files.length > 0 && (
            <div className="grid gap-2">
              {page.files.map((file) => (
                <FileEditRow key={file.id} file={file} />
              ))}
            </div>
          )}
          <UploadFileForm pageId={page.id} />
        </div>
      )}
    </div>
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
  presentation:
    "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 ring-orange-200/50",
  manual: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 ring-blue-200/50",
  schema:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 ring-emerald-200/50",
  template:
    "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 ring-purple-200/50",
  material: "bg-slate-50 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300 ring-slate-200/50",
};

const CATEGORY_META = {
  presentation: {
    icon: Presentation,
    colorClass: "text-orange-600 dark:text-orange-400",
    bgClass: "bg-orange-50 dark:bg-orange-950/30",
    borderClass: "hover:border-orange-300 hover:shadow-orange-500/5 dark:hover:border-orange-800",
  },
  manual: {
    icon: BookOpen,
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    borderClass: "hover:border-blue-300 hover:shadow-blue-500/5 dark:hover:border-blue-800",
  },
  schema: {
    icon: Network,
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    borderClass: "hover:border-emerald-300 hover:shadow-emerald-500/5 dark:hover:border-emerald-800",
  },
  template: {
    icon: Layers,
    colorClass: "text-purple-600 dark:text-purple-400",
    bgClass: "bg-purple-50 dark:bg-purple-950/30",
    borderClass: "hover:border-purple-300 hover:shadow-purple-500/5 dark:hover:border-purple-800",
  },
  material: {
    icon: FileText,
    colorClass: "text-slate-600 dark:text-slate-400",
    bgClass: "bg-slate-50 dark:bg-slate-900/40",
    borderClass: "hover:border-slate-300 hover:shadow-slate-500/5 dark:hover:border-slate-800",
  },
};

function getCategoryMeta(category: string) {
  return CATEGORY_META[category as keyof typeof CATEGORY_META] || CATEGORY_META.material;
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
      toast.error("Soubor se nepodařilo stáhnout.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
      {files.map((file) => {
        const meta = getCategoryMeta(file.category);
        const Icon = meta.icon;
        const isDownloading = downloading === file.id;
        const ext = file.fileName.split(".").pop()?.toUpperCase() || "FILE";

        return (
          <div
            key={file.id}
            onClick={() => !isDownloading && handleDownload(file.id)}
            className="group flex items-center gap-3.5 rounded-xl border border-border/80 bg-surface/50 p-3.5 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md hover:border-subject/40"
          >
            {/* File Icon */}
            <div className="relative shrink-0">
              <div
                className={`grid h-11 w-11 place-items-center rounded-lg transition-transform duration-200 group-hover:scale-105 ${meta.bgClass}`}
              >
                <Icon className={`h-5 w-5 ${meta.colorClass}`} />
              </div>
            </div>

            {/* Label + meta */}
            <div className="min-w-0 flex-1">
              <h4 className="font-display font-semibold text-sm leading-snug text-foreground group-hover:text-subject transition-colors truncate">
                {file.label}
              </h4>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ring-1 ${
                    CATEGORY_COLORS[file.category] || CATEGORY_COLORS.material
                  }`}
                >
                  {ext}
                </span>
                {!file.isPublished && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-[10px] font-bold uppercase tracking-wider dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/30">
                    Koncept
                  </span>
                )}
              </div>
            </div>

            {/* Download button */}
            <button
              type="button"
              disabled={isDownloading}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-subject text-subject-foreground transition-all group-hover:brightness-105"
            >
              {isDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
            </button>
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
  const [showAssignments, setShowAssignments] = useState(page.showAssignments);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await update({ data: { id: page.id, title, content, showAssignments } });
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
        className="rounded-md border border-input bg-background px-3 py-2 font-display text-lg font-semibold outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={14}
        placeholder={"# Nadpis\n\nOdstavec textu…\n\n## Podnadpis\n\n- odrážka\n- další odrážka"}
        className="mono rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
      />
      <p className="text-xs text-muted-foreground">
        Formátování: # nadpis, ## podnadpis, - odrážky, **tučně**, [odkaz](https://...),
        ![obrázek](https://...).
      </p>

      <label className="flex items-center gap-2 text-sm font-semibold text-foreground cursor-pointer mt-1">
        <input
          type="checkbox"
          checked={showAssignments}
          onChange={(e) => setShowAssignments(e.target.checked)}
          className="rounded border-input bg-background outline-none text-subject focus:ring-ring"
        />
        Zobrazit úkoly pod touto stránkou
      </label>

      <div className="flex gap-2 mt-4 border-t border-border pt-4">
        <button
          onClick={save}
          disabled={busy}
          className="subject-button inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          <Check className="h-4 w-4" /> {busy ? "Ukládám…" : "Uložit stránku"}
        </button>
        <button
          onClick={onDone}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm bg-surface hover:bg-muted text-foreground"
        >
          <X className="h-4 w-4" /> Zrušit
        </button>
      </div>
    </div>
  );
}

function FileEditRow({ file }: { file: SubjectFileItem }) {
  const router = useRouter();
  const deleteFile = useServerFn(deleteCourseFile);
  const updateFile = useServerFn(updateCourseFile);
  const setPublished = useServerFn(setCourseFilePublished);

  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(file.label);
  const [category, setCategory] = useState(file.category);
  const [description, setDescription] = useState(file.description);
  const [busy, setBusy] = useState(false);
  const { confirm } = useDialog();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateFile({ data: { id: file.id, label, category, description } });
      setIsEditing(false);
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Smazat soubor „${file.label}“?`,
      message: "Soubor bude trvale smazán a nebude možné jej stáhnout.",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteFile({ data: file.id });
      toast.success(`Soubor „${file.label}“ byl smazán.`);
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nepodařilo se smazat soubor.");
    } finally {
      setBusy(false);
    }
  };

  if (isEditing) {
    return (
      <form
        onSubmit={handleUpdate}
        className="p-3 border border-border bg-muted/10 rounded-lg space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-muted-foreground">
            Název
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground outline-none text-foreground"
            />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Kategorie
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground outline-none text-foreground"
            >
              <option value="presentation">Prezentace</option>
              <option value="manual">Manuál</option>
              <option value="schema">Schéma</option>
              <option value="template">Šablona</option>
              <option value="material">Materiál</option>
            </select>
          </label>
        </div>
        <label className="text-xs font-semibold text-muted-foreground block">
          Popis
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Stručný popis (nepovinné)"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground outline-none"
          />
        </label>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-2 py-1 rounded border border-border text-xs bg-surface text-foreground"
          >
            Zrušit
          </button>
          <button type="submit" disabled={busy} className="subject-button !px-2 !py-1 text-xs">
            Uložit
          </button>
        </div>
      </form>
    );
  }

  const togglePublished = async () => {
    setBusy(true);
    try {
      await setPublished({ data: { id: file.id, isPublished: !file.isPublished } });
      toast.success(file.isPublished ? "Materiál skryt (koncept)." : "Materiál zveřejněn.");
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 p-2.5 border border-border rounded-lg bg-card text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground truncate">{file.label}</p>
          {!file.isPublished && (
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
              Koncept
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {file.fileName} · {file.category}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={togglePublished}
          disabled={busy}
          className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted disabled:opacity-50"
          title={file.isPublished ? "Skrýt (přepnout na koncept)" : "Zveřejnit studentům"}
          aria-label={file.isPublished ? "Skrýt materiál" : "Zveřejnit materiál"}
        >
          {file.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
          title="Upravit"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50"
          title="Smazat"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function UploadFileForm({ pageId }: { pageId: string }) {
  const router = useRouter();
  const uploadFile = useServerFn(uploadCourseFile);

  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("material");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !label) {
      const baseName = file.name.split(".").slice(0, -1).join(".") || file.name;
      setLabel(baseName.replace(/[_-]+/g, " "));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Vyberte soubor.");
      return;
    }
    setError(null);
    setBusy(true);

    try {
      const fd = new FormData();
      fd.set("pageId", pageId);
      fd.set("label", label || file.name);
      fd.set("category", category);
      fd.set("description", description);
      fd.set("file", file);

      await uploadFile({ data: fd });
      setLabel("");
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nahrání selhalo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleUpload}
      className="p-3 border border-dashed border-border rounded-lg space-y-2.5 bg-muted/5"
    >
      <p className="text-xs font-semibold text-foreground">Přidat soubor</p>

      <input
        ref={fileRef}
        type="file"
        required
        onChange={handleFileChange}
        className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-subject file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[color:var(--subject-foreground)] text-foreground"
      />

      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Název"
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none"
        >
          <option value="material">Materiál</option>
          <option value="presentation">Prezentace</option>
          <option value="manual">Manuál</option>
          <option value="schema">Schéma</option>
          <option value="template">Šablona</option>
        </select>
      </div>

      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Popis (nepovinné)"
        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="subject-button inline-flex items-center gap-1.5 !py-1.5 !px-3 text-xs disabled:opacity-60"
      >
        <Upload className="h-3.5 w-3.5" />
        {busy ? "Nahrávám…" : "Nahrát"}
      </button>
    </form>
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
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line.trim());
    if (img) {
      blocks.push(
        <img
          key={key++}
          src={img[2]}
          alt={img[1]}
          className="my-4 max-h-96 w-auto rounded-xl border border-border"
        />,
      );
      continue;
    }
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
                className="surface-card grid items-center gap-3 p-5 transition-shadow hover:shadow-[var(--shadow-elevated)] sm:grid-cols-[minmax(0,1fr)_auto_150px]"
              >
                <div className="min-w-0">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground line-clamp-1">{a.description}</p>
                </div>
                <div className="flex items-center justify-end text-sm">
                  <AssignmentBadge a={a} staff={staff} />
                </div>
                <span className="mono text-sm text-muted-foreground sm:text-right">
                  {formatDateTime(a.dueAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const TARGET_HINT: Record<TargetType, string> = {
  INDIVIDUAL: "Každý student odevzdává a má vlastní známku.",
  PAIR: "Odevzdává dvojice — společná známka.",
  GROUP: "Odevzdává celá učební skupina.",
};

function CreateAssignment({ subjectId, pageId }: { subjectId: string; pageId?: string }) {
  const subject = subjectRoute.useLoaderData() as SubjectDetail;
  const router = useRouter();
  const create = useServerFn(createAssignment);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("PAIR");
  const [isPublished, setIsPublished] = useState(true);
  const [requiresConsent, setRequiresConsent] = useState(false);
  const [consentText, setConsentText] = useState(
    "Byl jsem seznámen s podmínkami zadání, kritérii hodnocení a zadání rozumím.",
  );
  const [selectedPageId, setSelectedPageId] = useState(pageId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await create({
        data: {
          subjectId,
          title,
          description,
          dueDate,
          targetType,
          isPublished,
          requiresConsent,
          consentText: requiresConsent ? consentText : "",
          pageId: selectedPageId || null,
        },
      });
      setTitle("");
      setDescription("");
      setDueDate("");
      setRequiresConsent(false);
      setConsentText("Byl jsem seznámen s podmínkami zadání, kritérii hodnocení a zadání rozumím.");
      setOpen(false);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vytvoření selhalo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="subject-button inline-flex items-center gap-1.5"
      >
        <Plus className="h-4 w-4" /> Nový úkol
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={submit}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-[var(--shadow-elevated)]"
          >
            <header className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
              <h3 className="font-display text-lg font-bold text-foreground">Nový úkol</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Zavřít"
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="grid gap-4 p-6">
              <label className="block text-xs font-semibold text-muted-foreground">
                Název úkolu
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Např. Návrh & program osvětlení"
                  required
                  autoFocus
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                />
              </label>

              <label className="block text-xs font-semibold text-muted-foreground">
                Zadání (co mají studenti udělat a odevzdat)
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Popište požadavky, formát odevzdání (např. ZIP se zdrojovými soubory)…"
                  rows={4}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                />
              </label>

              <label className="block text-xs font-semibold text-muted-foreground">
                Termín odevzdání
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                />
              </label>

              <fieldset>
                <legend className="text-xs font-semibold text-muted-foreground">
                  Kdo odevzdává
                </legend>
                <div className="mt-1.5 grid gap-2">
                  {TARGET_TYPES.map((t) => (
                    <label
                      key={t}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        targetType === t
                          ? "border-subject/50 bg-subject-soft/40 ring-1 ring-subject/30"
                          : "border-border hover:bg-accent/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="targetType"
                        checked={targetType === t}
                        onChange={() => setTargetType(t)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-sm font-medium text-foreground">
                          {TARGET_LABEL[t]}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {TARGET_HINT[t]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={requiresConsent}
                  onChange={(e) => setRequiresConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium text-foreground">
                    Vyžadovat digitální potvrzení studenta
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Student bude muset před odevzdáním potvrdit seznámení se s kritérii.
                  </span>
                </span>
              </label>

              {requiresConsent && (
                <label className="block text-xs font-semibold text-muted-foreground animate-in fade-in duration-200">
                  Text potvrzení / prohlášení
                  <textarea
                    value={consentText}
                    onChange={(e) => setConsentText(e.target.value)}
                    placeholder="Např. Byl jsem seznámen s podmínkami zadání, kritérii hodnocení a zadání rozumím..."
                    rows={3}
                    required
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                  />
                </label>
              )}

              <label className="block text-xs font-semibold text-muted-foreground">
                Přiřadit ke stránce kurzu
                <select
                  value={selectedPageId}
                  onChange={(e) => setSelectedPageId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                >
                  <option value="">Žádná (obecný úkol)</option>
                  {subject.pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium text-foreground">Zadat hned</span>
                  <span className="block text-xs text-muted-foreground">
                    Studenti úkol uvidí hned. Jinak zůstane jako koncept.
                  </span>
                </span>
              </label>

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>

            <footer className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Storno
              </button>
              <button
                type="submit"
                disabled={busy}
                className="subject-button rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {busy ? "Vytvářím…" : isPublished ? "Vytvořit a zadat" : "Vytvořit jako koncept"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}

function AssignmentBadge({ a, staff }: { a: AssignmentOverview; staff: boolean }) {
  if (staff) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {TARGET_LABEL[a.targetType]}
        </span>
        {a.isPublished ? (
          <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
            {a.submittedUnits}/{a.totalUnits} odevzdáno
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
            Nezadáno
          </span>
        )}
      </span>
    );
  }
  if (!a.myStatus) return null;
  const chip = STATUS_CHIP[a.myStatus];
  return (
    <span className="flex items-center gap-1.5">
      {a.myGrade && (
        <span className="rounded-full bg-subject-soft px-2.5 py-1 text-xs font-bold ring-1 ring-subject/30">
          {a.myGrade}
        </span>
      )}
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${chip.cls}`}>
        {chip.label}
      </span>
    </span>
  );
}
