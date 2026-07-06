import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import {
  X,
  Lock,
  Unlock,
  Calendar,
  GraduationCap,
  Download,
  History,
  AlertCircle,
  Clock,
  Eye,
  Loader2,
  FileText,
} from "lucide-react";
import { updateSubmissionState, downloadSubmission } from "@/lib/actions";
import { formatDateTime, formatBytes } from "@/lib/format";
import type { VersionItem } from "@/lib/types";

interface GradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  assignmentTitle: string;
  dueDate: string;
  targetType: string;
  unit: {
    key: string;
    name: string;
    members: { id: string; name: string }[];
    versionsList: VersionItem[];
    grade: string | null;
    feedback: string | null;
    locked: boolean;
    extension: string | null;
  };
}

function triggerDownload(fileName: string, mimeType: string, base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function GradingModal({
  isOpen,
  onClose,
  assignmentId,
  assignmentTitle,
  dueDate,
  targetType,
  unit,
}: GradingModalProps) {
  const router = useRouter();
  const saveState = useServerFn(updateSubmissionState);
  const downloadFn = useServerFn(downloadSubmission);

  const [grade, setGrade] = useState(unit.grade ?? "");
  const [feedback, setFeedback] = useState(unit.feedback ?? "");
  const [locked, setLocked] = useState(unit.locked);
  // local extension format: 'YYYY-MM-DDTHH:mm'
  const [extension, setExtension] = useState(unit.extension ? unit.extension.slice(0, 16) : "");

  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [previewData, setPreviewData] = useState<{
    id: string;
    fileName: string;
    mimeType: string;
    content?: string;
    dataUrl?: string;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handleDownload = async (id: string) => {
    setDownloading(id);
    try {
      const res = await downloadFn({ data: id });
      triggerDownload(res.fileName, res.mimeType, res.dataBase64);
    } catch (err) {
      console.error("Stažení selhalo:", err);
    } finally {
      setDownloading(null);
    }
  };

  const handlePreview = async (v: VersionItem) => {
    setLoadingPreview(true);
    setPreviewError(null);
    // Set placeholder to trigger layout split immediately
    setPreviewData({ id: v.id, fileName: v.fileName, mimeType: "" });
    try {
      const res = await downloadFn({ data: v.id });
      const ext = v.fileName.split(".").pop()?.toLowerCase();
      const mime = res.mimeType || "";

      let content: string | undefined;
      let dataUrl: string | undefined;

      const isText =
        mime.startsWith("text/") ||
        [
          "txt",
          "js",
          "jsx",
          "ts",
          "tsx",
          "html",
          "css",
          "json",
          "py",
          "cpp",
          "h",
          "java",
          "go",
          "rs",
          "php",
          "sql",
          "yaml",
          "yml",
          "sh",
          "md",
        ].includes(ext || "");

      const isImage =
        mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext || "");
      const isPdf = mime === "application/pdf" || ext === "pdf";

      if (isImage || isPdf) {
        dataUrl = `data:${res.mimeType};base64,${res.dataBase64}`;
      } else if (isText) {
        try {
          const binaryString = atob(res.dataBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          content = new TextDecoder("utf-8").decode(bytes);
        } catch (decErr) {
          content = atob(res.dataBase64);
        }
      }

      setPreviewData({
        id: v.id,
        fileName: v.fileName,
        mimeType: res.mimeType,
        content,
        dataUrl,
      });
    } catch (err) {
      console.error("Preview failed:", err);
      setPreviewError("Náhled souboru se nepodařilo načíst.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const userIds = unit.members.map((m) => m.id);
      await saveState({
        data: {
          assignmentId,
          userIds,
          value: grade || null,
          note: feedback || null,
          locked,
          extension: extension ? new Date(extension).toISOString() : null,
        },
      });
      await router.invalidate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uložení selhalo.");
    } finally {
      setBusy(false);
    }
  };

  // Determine submission status label
  const hasSubmissions = unit.versionsList.length > 0;
  const isOverdue = !hasSubmissions && new Date(unit.extension || dueDate).getTime() < Date.now();
  const statusLabel = grade
    ? "Ohodnoceno"
    : unit.locked
      ? "Uzamčeno pro úpravy"
      : hasSubmissions
        ? "Odevzdáno k ohodnocení"
        : isOverdue
          ? "Po termínu (Neodevzdáno)"
          : "Čeká na odevzdání";

  const statusColor = grade
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : unit.locked
      ? "bg-slate-100 text-slate-700 ring-slate-200"
      : hasSubmissions
        ? "bg-blue-50 text-blue-700 ring-blue-200"
        : isOverdue
          ? "bg-red-50 text-red-700 ring-red-200"
          : "bg-amber-50 text-amber-700 ring-amber-200";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity duration-200">
      <div
        className={`bg-surface rounded-2xl shadow-elevated border border-border flex flex-col overflow-hidden transform scale-100 transition-all duration-200 h-[90vh] ${
          previewData ? "max-w-6xl w-full" : "max-w-2xl w-full"
        }`}
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
          <div>
            <h3 className="font-display font-bold text-lg text-foreground">Hodnocení</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {assignmentTitle} · {targetType}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Outer Split Container */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* LEFT COLUMN: PREVIEW PANEL (only visible if previewData is active) */}
          {previewData && (
            <div className="w-3/5 border-r border-border flex flex-col bg-muted/10 min-w-0">
              <header className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
                <span className="text-xs font-semibold text-foreground truncate max-w-sm">
                  Náhled: {previewData.fileName}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewData(null)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Zavřít náhled
                </button>
              </header>

              <div className="flex-1 overflow-auto p-4 flex flex-col justify-center items-center min-h-0">
                {loadingPreview ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-subject" />
                    <span className="text-xs text-muted-foreground">Načítám soubor...</span>
                  </div>
                ) : previewError ? (
                  <div className="text-sm text-red-600 p-4 border border-red-200 bg-red-50 rounded-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    <span>{previewError}</span>
                  </div>
                ) : (
                  <PreviewContent data={previewData} />
                )}
              </div>
            </div>
          )}

          {/* RIGHT COLUMN: GRADING FORM */}
          <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 min-w-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border/50">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                    Odevzdává
                  </span>
                  <span className="text-sm font-semibold text-foreground block mt-0.5">
                    {unit.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Členové: {unit.members.map((m) => m.name).join(", ")}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                    Stav odevzdání
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusColor}`}
                    >
                      {statusLabel}
                    </span>
                    {unit.locked && (
                      <span className="text-slate-500" title="Uzamčeno">
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Grading & Feedback */}
              <div className="space-y-4">
                <h4 className="font-display font-semibold text-sm flex items-center gap-1.5 text-foreground border-b border-border/50 pb-1.5">
                  <GraduationCap className="h-4 w-4 text-subject" /> Hodnocení a zpětná vazba
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-4 items-start">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Známka
                    </label>
                    <input
                      type="text"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="—"
                      className="w-full text-center rounded-lg border border-input bg-background py-2 text-base font-bold outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
                    />

                    {/* Quick Grade Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                      {["1", "1-", "2", "2-", "3", "4", "5", "—"].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setGrade(v === "—" ? "" : v)}
                          className={`text-xs py-1 rounded border transition-all ${
                            (v === "—" ? grade === "" : grade === v)
                              ? "bg-subject border-subject text-[color:var(--subject-foreground)] font-bold shadow-sm"
                              : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-full flex flex-col">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Zpětná vazba
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Napište studentům slovní hodnocení..."
                      rows={4}
                      className="w-full flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 resize-none text-foreground leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Submission Settings (Lock & Deadline extension) */}
              <div className="space-y-4">
                <h4 className="font-display font-semibold text-sm flex items-center gap-1.5 text-foreground border-b border-border/50 pb-1.5">
                  <Clock className="h-4 w-4 text-subject" /> Nastavení termínu a odevzdávání
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Submission Lock */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground block">
                      Zámek odevzdání
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/10 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={locked}
                        onChange={(e) => setLocked(e.target.checked)}
                        className="h-4 w-4 rounded border-input text-subject focus:ring-subject"
                      />
                      <div className="text-sm">
                        <span className="font-medium text-foreground flex items-center gap-1">
                          {locked ? (
                            <>
                              <Lock className="h-3.5 w-3.5 text-red-500" /> Uzamčeno
                            </>
                          ) : (
                            <>
                              <Unlock className="h-3.5 w-3.5 text-emerald-500" /> Odemčeno
                            </>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground block mt-0.5">
                          Studenti nebudou moci nahrávat další verze.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Deadline extension */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Prodloužený termín
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="datetime-local"
                          value={extension}
                          onChange={(e) => setExtension(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                        />
                      </div>
                      {extension && (
                        <button
                          type="button"
                          onClick={() => setExtension("")}
                          className="px-3 rounded-lg border border-border hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-xs transition-colors"
                          title="Zrušit prodloužení"
                        >
                          Vymazat
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground block mt-1 leading-normal">
                      Původní termín: {formatDateTime(dueDate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submission history & Downloads */}
              <div className="space-y-3">
                <h4 className="font-display font-semibold text-sm flex items-center gap-1.5 text-foreground border-b border-border/50 pb-1.5">
                  <History className="h-4 w-4 text-subject" /> Historie odevzdaných souborů (
                  {unit.versionsList.length})
                </h4>

                {unit.versionsList.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 text-center border border-dashed border-border rounded-lg">
                    Zatím nebyly nahrány žádné soubory.
                  </p>
                ) : (
                  <ul className="divide-y divide-border border border-border rounded-lg bg-muted/5 overflow-hidden">
                    {unit.versionsList.map((v) => (
                      <li
                        key={v.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 text-sm hover:bg-muted/10 transition-colors"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="mono font-semibold text-xs text-subject bg-subject-soft px-1.5 py-0.5 rounded">
                              v{v.version}
                            </span>
                            <p
                              className="font-semibold text-foreground truncate mono max-w-[280px]"
                              title={v.fileName}
                            >
                              {v.fileName}
                            </p>
                          </div>
                          {v.note && (
                            <p className="text-xs text-muted-foreground italic truncate max-w-sm">
                              Poznámka: „{v.note}“
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            Nahrál: {v.uploadedByName} · {formatDateTime(v.uploadedAt)} ·{" "}
                            {formatBytes(v.fileSize)}
                          </p>
                        </div>

                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePreview(v)}
                            disabled={loadingPreview && previewData?.id === v.id}
                            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-60 transition-colors bg-surface text-foreground font-medium"
                          >
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            {loadingPreview && previewData?.id === v.id ? "Načítám..." : "Náhled"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(v.id)}
                            disabled={downloading === v.id}
                            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-60 transition-colors bg-surface text-foreground font-medium"
                          >
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                            {downloading === v.id ? "Stahuji..." : "Stáhnout"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <footer className="px-6 py-4 border-t border-border bg-muted/20 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                Storno
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-subject text-[color:var(--subject-foreground)] text-sm font-semibold shadow hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {busy ? "Ukládám..." : "Uložit změny"}
              </button>
            </footer>
          </form>
        </div>
      </div>
    </div>
  );
}

function PreviewContent({
  data,
}: {
  data: { fileName: string; mimeType: string; content?: string; dataUrl?: string };
}) {
  const ext = data.fileName.split(".").pop()?.toLowerCase();
  const mime = data.mimeType || "";

  const isImage =
    mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext || "");
  const isPdf = mime === "application/pdf" || ext === "pdf";
  const isText =
    mime.startsWith("text/") ||
    [
      "txt",
      "js",
      "jsx",
      "ts",
      "tsx",
      "html",
      "css",
      "json",
      "py",
      "cpp",
      "h",
      "java",
      "go",
      "rs",
      "php",
      "sql",
      "yaml",
      "yml",
      "sh",
      "md",
    ].includes(ext || "");

  if (isImage && data.dataUrl) {
    return (
      <img
        src={data.dataUrl}
        alt={data.fileName}
        className="max-w-full max-h-full object-contain rounded border border-border shadow-sm bg-white"
      />
    );
  }

  if (isPdf && data.dataUrl) {
    return (
      <iframe
        src={data.dataUrl}
        title={data.fileName}
        className="w-full h-full border border-border rounded bg-white"
      />
    );
  }

  if (isText && data.content !== undefined) {
    return (
      <pre className="w-full h-full p-4 bg-muted/40 text-foreground font-mono text-xs overflow-auto rounded border border-border leading-relaxed whitespace-pre-wrap">
        {data.content}
      </pre>
    );
  }

  return (
    <div className="text-center p-6 space-y-3">
      <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
      <div>
        <p className="text-sm font-semibold text-foreground">{data.fileName}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Tento typ souboru ({data.mimeType || ext || "neznámý"}) nelze zobrazit přímo v prohlížeči.
        </p>
      </div>
    </div>
  );
}
