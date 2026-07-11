import { createFileRoute, Link, useRouter, getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Download,
  History,
  Upload,
  Users2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  EyeOff,
  Megaphone,
  User as UserIcon,
  Clock,
  Lock,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { requireUser } from "@/lib/guards";
import { getAssignment } from "@/lib/data";
import {
  uploadSubmission,
  downloadSubmission,
  updateSubmissionState,
  setAssignmentPublished,
  updateAssignment,
  deleteAssignment,
  recordConsent,
  downloadAllSubmissionsZip,
} from "@/lib/actions";
import { useUser } from "@/lib/use-user";
import { isStaff } from "@/lib/roles";
import { formatDateTime, formatBytes } from "@/lib/format";
import {
  TARGET_LABEL,
  type AssignmentDetail,
  type UnitView,
  type VersionItem,
  type SubjectDetail,
} from "@/lib/types";
import { GradingModal } from "@/components/grading-modal";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";

const subjectRoute = getRouteApi("/subjects/$slug");

export const Route = createFileRoute("/subjects/$slug/assignments/$aid")({
  beforeLoad: ({ context }) => {
    requireUser(context.user);
  },
  loader: ({ params }) => getAssignment({ data: params.aid }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.title} — Školka` }] : [],
  }),
  component: AssignmentPage,
});

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

function useDownload() {
  const downloadFn = useServerFn(downloadSubmission);
  const [downloading, setDownloading] = useState<string | null>(null);
  const download = async (id: string) => {
    setDownloading(id);
    try {
      const res = await downloadFn({ data: id });
      triggerDownload(res.fileName, res.mimeType, res.dataBase64);
    } finally {
      setDownloading(null);
    }
  };
  return { download, downloading };
}

function AssignmentPage() {
  const assignment = Route.useLoaderData() as AssignmentDetail;
  const { slug } = Route.useParams();
  const user = useUser();
  const staff = !!user && isStaff(user.role);

  const myUnit = !staff ? assignment.units[0] : null;

  return (
    <main>
      <Link
        to="/subjects/$slug"
        params={{ slug }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Zpět na kurz
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">{assignment.title}</h1>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {TARGET_LABEL[assignment.targetType]}
          </span>
          {!assignment.isPublished && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              <EyeOff className="h-3 w-3" /> Nezadáno — studenti nevidí
            </span>
          )}
        </div>
        <p className="mt-2 max-w-2xl text-muted-foreground">{assignment.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="mono">Termín: {formatDateTime(assignment.dueAt)}</span>
          {myUnit?.extension && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
              <Clock className="h-3.5 w-3.5" /> Prodlouženo do: {formatDateTime(myUnit.extension)}
            </span>
          )}
        </div>
        {staff && <StaffAssignmentControls assignment={assignment} />}
      </header>

      {assignment.canUpload &&
        (assignment.requiresConsent && !assignment.myConsent ? (
          <ConsentCard assignment={assignment} />
        ) : (
          <UploadCard assignmentId={assignment.id} />
        ))}

      {staff ? <StaffUnits assignment={assignment} /> : <StudentView assignment={assignment} />}
    </main>
  );
}

function StaffAssignmentControls({ assignment }: { assignment: AssignmentDetail }) {
  const router = useRouter();
  const { slug } = Route.useParams();
  const publish = useServerFn(setAssignmentPublished);
  const deleteAct = useServerFn(deleteAssignment);

  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const { confirm } = useDialog();

  const togglePublish = async () => {
    setBusy(true);
    try {
      await publish({ data: { id: assignment.id, isPublished: !assignment.isPublished } });
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Smazat úkol „${assignment.title}“?`,
      message: "Dojde ke smazání všech odevzdaných souborů a hodnocení. Tato akce je nevratná!",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteAct({ data: assignment.id });
      toast.success("Úkol smazán.");
      router.navigate({ to: "/subjects/$slug", params: { slug } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smazání selhalo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="staff-toolbar">
      <button
        onClick={togglePublish}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
          assignment.isPublished
            ? "border border-border text-muted-foreground hover:bg-accent bg-surface"
            : "subject-button"
        }`}
      >
        {assignment.isPublished ? (
          <>
            <EyeOff className="h-4 w-4" /> {busy ? "…" : "Zrušit zadání"}
          </>
        ) : (
          <>
            <Megaphone className="h-4 w-4" /> {busy ? "…" : "Zadat studentům"}
          </>
        )}
      </button>

      <button
        onClick={() => setModalOpen(true)}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent bg-surface text-foreground"
      >
        <Pencil className="h-4 w-4 text-muted-foreground" />
        Upravit úkol
      </button>

      <button
        onClick={handleDelete}
        disabled={busy}
        title="Smazat úkol"
        aria-label="Smazat úkol"
        className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-600 bg-surface disabled:opacity-60"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {modalOpen && (
        <EditAssignmentModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          assignment={assignment}
        />
      )}
    </div>
  );
}

function EditAssignmentModal({
  isOpen,
  onClose,
  assignment,
}: {
  isOpen: boolean;
  onClose: () => void;
  assignment: AssignmentDetail;
}) {
  const router = useRouter();
  const update = useServerFn(updateAssignment);
  const subject = subjectRoute.useLoaderData() as SubjectDetail;

  const [title, setTitle] = useState(assignment.title);
  const [description, setDescription] = useState(assignment.description);
  const [dueDate, setDueDate] = useState(assignment.dueAt.slice(0, 16));
  const [targetType, setTargetType] = useState<"INDIVIDUAL" | "PAIR" | "GROUP">(
    assignment.targetType,
  );
  const [requiresConsent, setRequiresConsent] = useState(assignment.requiresConsent);
  const [consentText, setConsentText] = useState(
    assignment.consentText ||
      "Byl jsem seznámen s podmínkami zadání, kritérii hodnocení a zadání rozumím.",
  );
  const [pageId, setPageId] = useState(assignment.pageId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await update({
        data: {
          id: assignment.id,
          title,
          description,
          dueDate: new Date(dueDate).toISOString(),
          targetType,
          requiresConsent,
          consentText: requiresConsent ? consentText : "",
          pageId: pageId || null,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm text-sm">
      <div className="bg-surface rounded-2xl shadow-elevated border border-border max-w-lg w-full overflow-hidden">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <h3 className="font-display font-bold text-lg text-foreground">Upravit zadání úkolu</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="block text-xs font-semibold text-muted-foreground">
            Název úkolu
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
            />
          </label>

          <label className="block text-xs font-semibold text-muted-foreground">
            Zadání / Popis
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40 resize-none animate-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
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

            <label className="block text-xs font-semibold text-muted-foreground">
              Typ odevzdávání
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as "INDIVIDUAL" | "PAIR" | "GROUP")}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
              >
                <option value="INDIVIDUAL">Samostatně (Jednotlivec)</option>
                <option value="PAIR">Ve dvojici (stabilní dvojice)</option>
                <option value="GROUP">Ve skupině (třída/skupina)</option>
              </select>
            </label>
          </div>

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
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40 resize-none animate-none"
              />
            </label>
          )}

          <label className="block text-xs font-semibold text-muted-foreground">
            Přiřadit ke stránce kurzu
            <select
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
            >
              <option value="">Žádná (obecný úkol)</option>
              {subject.pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground bg-surface"
            >
              Storno
            </button>
            <button
              type="submit"
              disabled={busy}
              className="subject-button px-4 py-2 rounded-lg text-sm font-semibold shadow"
            >
              {busy ? "Ukládám..." : "Uložit změny"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConsentCard({ assignment }: { assignment: AssignmentDetail }) {
  const router = useRouter();
  const record = useServerFn(recordConsent);
  const [variant, setVariant] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      setError("Musíte potvrdit souhlas se zněním prohlášení.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await record({
        data: {
          assignmentId: assignment.id,
          variant: variant || null,
        },
      });
      toast.success("Souhlas byl úspěšně udělen.");
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Odeslání souhlasu selhalo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="surface-card mt-6 p-6 border border-amber-200 bg-amber-50/10 dark:bg-amber-950/5 animate-in fade-in duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-100 dark:bg-amber-900/50 p-2 text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h2 className="font-display font-semibold text-lg text-foreground">
            Vyžadováno digitální potvrzení studenta
          </h2>
          <p className="text-xs text-muted-foreground">
            Tento úkol vyžaduje seznámení se s kritérii a udělení souhlasu před odevzdáním prací.
          </p>
        </div>
      </div>

      <div className="mt-4 p-4 rounded-xl bg-surface border border-border text-sm leading-relaxed text-foreground whitespace-pre-wrap font-medium shadow-inner">
        {assignment.consentText ||
          "Souhlasím s podmínkami zadání a kritérii hodnocení tohoto úkolu."}
      </div>

      <div className="mt-4 space-y-4">
        <label className="block text-xs font-semibold text-muted-foreground max-w-md">
          Varianta / Téma projektu (pokud je vyžadováno)
          <input
            type="text"
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
            placeholder="Např. Varianta A / Téma: Chytrý dům"
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
          />
        </label>

        <label className="flex items-start gap-2.5 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span className="text-foreground font-medium">
            Prohlašuji, že jsem se plně seznámil se zadáním, požadavky a kritérii hodnocení a
            vyjadřuji s nimi svůj souhlas.
          </span>
        </label>

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

        <div className="pt-2">
          <button
            type="submit"
            disabled={busy}
            className="subject-button inline-flex items-center justify-center gap-1.5 disabled:opacity-60 font-semibold"
          >
            <CheckCircle2 className="h-4 w-4" />
            {busy ? "Odesílám..." : "Udělit digitální souhlas a odemknout odevzdávání"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ---------- upload ---------- */

function UploadCard({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const uploadFn = useServerFn(uploadSubmission);
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
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
      fd.set("assignmentId", assignmentId);
      fd.set("file", file);
      if (note) fd.set("note", note);
      await uploadFn({ data: fd });
      setNote("");
      if (fileRef.current) fileRef.current.value = "";
      await router.invalidate();
      qc.invalidateQueries({ queryKey: ["student-panel"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nahrání selhalo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface-card mt-6 p-5">
      <h2 className="font-display font-semibold flex items-center gap-2">
        <Upload className="h-4 w-4 text-subject" /> Odevzdat novou verzi
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-3">
          <input
            ref={fileRef}
            type="file"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-subject file:px-3 file:py-2 file:text-sm file:font-medium file:text-[color:var(--subject-foreground)]"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Poznámka k verzi (nepovinné)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <button
          disabled={busy}
          className="subject-button inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" /> {busy ? "Nahrávám…" : "Nahrát"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}

/* ---------- student view ---------- */

function StudentView({ assignment }: { assignment: AssignmentDetail }) {
  const user = useUser();
  const unit = assignment.units[0];

  if (!unit) {
    return (
      <p className="mt-8 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {assignment.targetType === "PAIR"
          ? "Nejste zařazeni do dvojice — požádejte vyučujícího."
          : "Nejste zařazeni do učební skupiny — požádejte vyučujícího."}
      </p>
    );
  }

  return (
    <section className="mt-8 space-y-5">
      {assignment.requiresConsent && assignment.myConsent && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-emerald-800 text-sm flex items-start gap-2.5 shadow-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600" />
          <div className="flex-1">
            <p className="font-semibold">Digitální souhlas byl udělen</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Dne {formatDateTime(assignment.myConsent.acceptedAt)} jste potvrdili seznámení se s
              kritérii.
              {assignment.myConsent.variant && (
                <>
                  {" "}
                  Zvolená varianta/téma: <strong>{assignment.myConsent.variant}</strong>
                </>
              )}
            </p>
            <details className="mt-2 text-xs text-emerald-950/70 border-t border-emerald-200/50 pt-2 cursor-pointer">
              <summary className="font-medium hover:underline">
                Zobrazit znění, se kterým jste souhlasili
              </summary>
              <p className="mt-1 whitespace-pre-wrap pl-3 border-l-2 border-emerald-300 italic">
                {assignment.myConsent.acceptedText}
              </p>
            </details>
          </div>
        </div>
      )}

      {unit.locked && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm flex items-start gap-2.5 shadow-sm">
          <Lock className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
          <div>
            <p className="font-semibold">Odevzdávání je uzamčeno</p>
            <p className="text-xs text-red-700 mt-0.5">
              Vyučující uzamkl toto odevzdání. Již nelze nahrávat další verze.
            </p>
          </div>
        </div>
      )}

      {unit.extension && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-amber-800 text-sm flex items-start gap-2.5 shadow-sm">
          <Clock className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-semibold">Máte prodloužený termín</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Byl vám nastaven prodloužený termín odevzdání do{" "}
              <strong>{formatDateTime(unit.extension)}</strong>.
            </p>
          </div>
        </div>
      )}

      {(unit.grade || unit.feedback) && (
        <div className="rounded-xl border border-border p-5 bg-card space-y-3 shadow-sm">
          <h3 className="font-display font-bold text-base text-foreground flex items-center gap-1.5">
            <GraduationCap className="h-5 w-5 text-subject" /> Hodnocení vyučujícího
          </h3>
          <div className="grid gap-3 sm:grid-cols-[120px_1fr] items-start">
            <div className="bg-subject-soft border border-subject/20 rounded-lg p-3 text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Známka
              </span>
              <span className="text-3xl font-display font-extrabold text-subject block mt-1">
                {unit.grade || "—"}
              </span>
            </div>
            {unit.feedback ? (
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                  Slovní komentář
                </span>
                <p className="text-sm text-foreground leading-relaxed bg-muted/25 p-3 rounded-lg border border-border/40 whitespace-pre-wrap">
                  {unit.feedback}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Vyučující nepřipojil žádný slovní komentář.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <Users2 className="h-5 w-5 text-subject" />
          {assignment.targetType === "INDIVIDUAL"
            ? "Moje odevzdání"
            : `${unit.name}${unit.studyGroupName ? ` · ${unit.studyGroupName}` : ""}`}
        </h2>
      </div>

      {assignment.targetType === "PAIR" && user && <PairLatest unit={unit} myId={user.id} />}

      <UnitVersions unit={unit} />
    </section>
  );
}

/** For pairs: your latest version and your partner's latest, side by side. */
function PairLatest({ unit, myId }: { unit: UnitView; myId: string }) {
  const { download, downloading } = useDownload();
  const mine = unit.versions.find((v) => v.uploadedById === myId);
  const partners = unit.versions.find((v) => v.uploadedById !== myId);
  const partnerName = unit.members.find((m) => m.id !== myId)?.name ?? "Parťák";

  const Box = ({
    label,
    version,
    icon: Icon,
  }: {
    label: string;
    version: VersionItem | undefined;
    icon: typeof UserIcon;
  }) => (
    <div className="rounded-xl border border-border p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      {version ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium mono text-sm">
              <span className="text-xs text-muted-foreground">v{version.version}</span>{" "}
              {version.fileName}
            </p>
            <p className="text-xs text-muted-foreground">{formatDateTime(version.uploadedAt)}</p>
          </div>
          <button
            onClick={() => download(version.id)}
            disabled={downloading === version.id}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" /> {downloading === version.id ? "…" : "Stáhnout"}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Zatím nic nenahráno.</p>
      )}
    </div>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Box label="Tvoje poslední verze" version={mine} icon={UserIcon} />
      <Box label={`Poslední od: ${partnerName}`} version={partners} icon={Users2} />
    </div>
  );
}

/* ---------- shared version list ---------- */

function UnitVersions({ unit, collapsible = false }: { unit: UnitView; collapsible?: boolean }) {
  const { download, downloading } = useDownload();

  if (unit.versions.length === 0) {
    return (
      <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        Zatím neodevzdáno.
      </p>
    );
  }

  const list = (
    <ul className="divide-y divide-border">
      {unit.versions.map((v) => (
        <li
          key={v.id}
          className="grid gap-2 px-1 py-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center sm:gap-4 text-sm"
        >
          <span className="mono inline-flex h-6 items-center justify-center rounded bg-muted px-2 text-xs font-medium">
            v{v.version}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium mono">{v.fileName}</p>
            {v.note && <p className="text-xs text-muted-foreground truncate">„{v.note}"</p>}
          </div>
          <span className="text-muted-foreground text-xs">
            {v.uploadedByName} · {formatDateTime(v.uploadedAt)} · {formatBytes(v.fileSize)}
          </span>
          <button
            onClick={() => download(v.id)}
            disabled={downloading === v.id}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" /> {downloading === v.id ? "…" : "Stáhnout"}
          </button>
        </li>
      ))}
    </ul>
  );

  if (!collapsible) {
    return (
      <div className="surface-card px-4 py-2">
        <div className="flex items-center gap-2 px-1 pt-2 text-xs uppercase tracking-wider text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Historie verzí
        </div>
        {list}
      </div>
    );
  }

  return (
    <details className="group mt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
        Historie verzí ({unit.versions.length})
      </summary>
      {list}
    </details>
  );
}

function GradeChip({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-subject-soft px-3 py-1 text-sm font-bold ring-1 ring-subject/30">
      <GraduationCap className="h-4 w-4" /> {value}
    </span>
  );
}

/* ---------- staff view: aligned grading table ---------- */

function StaffUnits({ assignment }: { assignment: AssignmentDetail }) {
  const { slug } = Route.useParams();
  const [grading, setGrading] = useState<UnitView | null>(null);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const downloadAll = useServerFn(downloadAllSubmissionsZip);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try {
      const res = await downloadAll({ data: assignment.id });
      triggerDownload(res.fileName, res.mimeType, res.dataBase64);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Chyba při stahování archivu.");
    } finally {
      setDownloadingAll(false);
    }
  };

  const groupNames = Array.from(
    new Set(assignment.units.map((u) => u.studyGroupName).filter((g): g is string => !!g)),
  ).sort((a, b) => a.localeCompare(b));
  const units =
    groupFilter === "all"
      ? assignment.units
      : assignment.units.filter((u) =>
          groupFilter === "none" ? !u.studyGroupName : u.studyGroupName === groupFilter,
        );

  const submitted = units.filter((u) => u.versions.length > 0).length;
  const graded = units.filter((u) => u.grade).length;
  const isIndividual = assignment.targetType === "INDIVIDUAL";

  const unsubmittedUnits = units.filter((u) => u.versions.length === 0);

  return (
    <section className="mt-8 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <Users2 className="h-5 w-5 text-subject" /> Odevzdání a hodnocení
        </h2>
        <div className="flex items-center gap-3">
          {groupNames.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Skupina:
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/40"
              >
                <option value="all">Všechny</option>
                {groupNames.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value="none">Bez skupiny</option>
              </select>
            </label>
          )}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              odevzdáno {submitted}/{units.length}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              oznámkováno {graded}/{units.length}
            </span>
          </div>
          <button
            onClick={handleDownloadAll}
            disabled={downloadingAll || submitted === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-subject/40 bg-subject-soft/30 hover:bg-subject-soft px-3 py-1.5 text-xs font-semibold text-subject transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            {downloadingAll ? "Zipuji..." : "Stáhnout vše (ZIP)"}
          </button>
        </div>
      </div>

      {unsubmittedUnits.length > 0 && (
        <div className="surface-card p-4 border-l-4 border-amber-500 bg-amber-50/20 dark:bg-amber-950/10">
          <h3 className="font-semibold text-amber-800 dark:text-amber-300 text-sm flex items-center gap-1.5 mb-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> Neodevzdali ({unsubmittedUnits.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {unsubmittedUnits.map((u) => (
              <span
                key={u.key}
                className="inline-flex items-center gap-1 bg-surface border border-border px-2.5 py-1 rounded-md text-xs text-foreground"
                title={u.members.map((m) => m.name).join(", ")}
              >
                <span className="font-medium">{u.name}</span>
                {u.members.length > 1 && (
                  <span className="text-muted-foreground text-[10px]">
                    ({u.members.map((m) => m.name.split(" ")[0]).join(", ")})
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {assignment.units.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Žádné jednotky — zkontrolujte Skupiny a dvojice v levém panelu.
        </p>
      ) : units.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Žádné jednotky ve zvolené skupině.
        </p>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">
                  {isIndividual
                    ? "Student"
                    : assignment.targetType === "PAIR"
                      ? "Dvojice"
                      : "Skupina"}
                </th>
                <th className="px-3 py-3 font-medium">Stav</th>
                <th className="px-3 py-3 font-medium">Poslední verze</th>
                <th className="px-3 py-3 text-center font-medium">Známka</th>
                <th className="px-3 py-3 text-right font-medium">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {units.map((u) => (
                <UnitRow
                  key={u.key}
                  unit={u}
                  assignment={assignment}
                  slug={slug}
                  onGrade={() => setGrading(u)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Kliknutím na řádek rozbalíte historii verzí. „Hodnotit" otevře panel se známkou, slovním
        komentářem, zámkem a prodloužením termínu.
      </p>

      {grading && (
        <GradingModal
          isOpen={!!grading}
          onClose={() => setGrading(null)}
          assignmentId={assignment.id}
          assignmentTitle={assignment.title}
          dueDate={assignment.dueAt}
          targetType={TARGET_LABEL[assignment.targetType]}
          unit={{
            key: grading.key,
            name: grading.name,
            members: grading.members,
            versionsList: grading.versions,
            grade: grading.grade,
            feedback: grading.feedback,
            locked: grading.locked,
            extension: grading.extension,
          }}
        />
      )}

      {assignment.requiresConsent && (
        <div className="surface-card p-5 mt-6 space-y-4">
          <h3 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-subject" />
            Evidence digitálních souhlasů (PRD §5B)
          </h3>
          {!assignment.consents || assignment.consents.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Dosud nebyl udělen žádný souhlas.
            </p>
          ) : (
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-2">Student</th>
                    <th className="px-4 py-2">Datum a čas</th>
                    <th className="px-4 py-2">Zvolená varianta</th>
                    <th className="px-4 py-2">Text odsouhlaseného znění</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {assignment.consents.map((c) => (
                    <tr key={c.userId} className="hover:bg-accent/20">
                      <td className="px-4 py-2.5 font-semibold">{c.userName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {formatDateTime(c.acceptedAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.variant ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            {c.variant}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">— bez varianty —</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 max-w-xs md:max-w-md">
                        <details className="cursor-pointer text-[11px] text-muted-foreground">
                          <summary className="hover:underline select-none">
                            Zobrazit znění ({c.acceptedText.slice(0, 30)}...)
                          </summary>
                          <p className="mt-1 whitespace-pre-wrap p-2 bg-muted/40 rounded border border-border/50 text-[10px] font-mono leading-normal">
                            {c.acceptedText}
                          </p>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function UnitRow({
  unit,
  assignment,
  slug,
  onGrade,
}: {
  unit: UnitView;
  assignment: AssignmentDetail;
  slug: string;
  onGrade: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const latest = unit.versions[0];
  const { download, downloading } = useDownload();

  const counts = new Map<string, number>();
  for (const v of unit.versions) {
    counts.set(v.uploadedById, (counts.get(v.uploadedById) ?? 0) + 1);
  }

  const memberConsented = (userId: string) => {
    return !!assignment.consents?.some((c) => c.userId === userId);
  };

  return (
    <>
      <tr
        onClick={() => unit.versions.length > 0 && setExpanded((v) => !v)}
        className={`transition-colors hover:bg-accent/40 ${unit.versions.length > 0 ? "cursor-pointer" : ""}`}
      >
        {/* Unit + members */}
        <td className="px-4 py-2.5 align-top">
          <div className="flex flex-wrap items-center gap-1.5">
            {unit.versions.length > 0 && (
              <ChevronRight
                className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
              />
            )}
            <span className="font-medium">
              {unit.members.length === 1 ? (
                <Link
                  to="/subjects/$slug/students/$sid"
                  params={{ slug, sid: unit.members[0].id }}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:underline"
                  title="Otevřít kartu žáka"
                >
                  {unit.name}
                </Link>
              ) : (
                unit.name
              )}
            </span>
            {assignment.requiresConsent &&
              unit.members.length === 1 &&
              (memberConsented(unit.members[0].id) ? (
                <span className="inline-flex items-center text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-1.5 py-0.5 font-bold">
                  ✓ souhlas
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] bg-red-50 text-red-700 border border-red-200 rounded-full px-1.5 py-0.5 font-bold">
                  ✗ bez souhlasu
                </span>
              ))}
            {unit.studyGroupName && unit.studyGroupName !== unit.name && (
              <span className="text-xs text-muted-foreground">· {unit.studyGroupName}</span>
            )}
            {unit.locked && (
              <Lock className="h-3.5 w-3.5 text-slate-400" aria-label="Odevzdávání uzamčeno" />
            )}
            {unit.extension && (
              <Clock
                className="h-3.5 w-3.5 text-amber-500"
                aria-label={`Prodlouženo do ${formatDateTime(unit.extension)}`}
              />
            )}
          </div>
          {unit.members.length > 1 && (
            <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
              {unit.members.map((m) => {
                const c = counts.get(m.id) ?? 0;
                const hasConsented = memberConsented(m.id);
                return (
                  <Link
                    key={m.id}
                    to="/subjects/$slug/students/$sid"
                    params={{ slug, sid: m.id }}
                    onClick={(e) => e.stopPropagation()}
                    title={`${m.name}: ${c}× nahráno — otevřít kartu žáka${
                      assignment.requiresConsent
                        ? hasConsented
                          ? " (souhlas udělen)"
                          : " (souhlas chybí!)"
                        : ""
                    }`}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs hover:ring-1 hover:ring-subject/50 ${
                      c > 0 ? "bg-subject-soft" : "bg-muted text-muted-foreground"
                    } ${
                      assignment.requiresConsent
                        ? hasConsented
                          ? "border border-emerald-200 bg-emerald-50/50 text-emerald-800"
                          : "border border-red-200 bg-red-50/50 text-red-800"
                        : ""
                    }`}
                  >
                    {assignment.requiresConsent && (
                      <span className="font-bold">{hasConsented ? "✓ " : "✗ "}</span>
                    )}
                    {m.name}
                    <span className={`font-semibold ${c === 0 ? "opacity-60" : "text-subject"}`}>
                      ×{c}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </td>

        {/* Status */}
        <td className="px-3 py-2.5 align-top">
          {latest ? (
            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              Odevzdáno
            </span>
          ) : new Date(unit.extension ?? assignment.dueAt).getTime() < Date.now() ? (
            <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
              Po termínu
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              Čeká
            </span>
          )}
        </td>

        {/* Latest version */}
        <td className="px-3 py-2.5 align-top text-xs text-muted-foreground">
          {latest ? (
            <div className="flex items-start gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  download(latest.id);
                }}
                disabled={downloading === latest.id}
                title="Stáhnout nejnovější odevzdání"
                className="inline-flex items-center gap-1 font-semibold text-subject hover:underline mono disabled:opacity-60 text-left cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />v{latest.version}
              </button>
              <div className="min-w-0">
                <div>{formatDateTime(latest.uploadedAt)}</div>
                <span className="block truncate max-w-48 text-muted-foreground">
                  {latest.uploadedByName}
                </span>
              </div>
            </div>
          ) : (
            "—"
          )}
        </td>

        {/* Grade */}
        <td className="px-3 py-2.5 text-center align-top" onClick={(e) => e.stopPropagation()}>
          <GradeInput
            assignmentId={assignment.id}
            userIds={unit.members.map((m) => m.id)}
            initial={unit.grade}
          />
          {!unit.grade &&
            !latest &&
            new Date(unit.extension ?? assignment.dueAt).getTime() < Date.now() && (
              <div className="relative mt-1.5 flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-red-500" title="Nehodnoceno — po termínu">
                  N
                </span>
                {unit.latePenalties.length > 0 && (
                  <details onClick={(e) => e.stopPropagation()}>
                    <summary
                      title="Penalizace za time management"
                      className="inline-flex h-3.5 min-w-3.5 cursor-pointer list-none items-center justify-center rounded-full bg-red-100 px-1 text-[8px] font-bold text-red-700 ring-1 ring-red-200 select-none"
                    >
                      +{unit.latePenalties.length}×5
                    </summary>
                    <div className="absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-red-200 bg-red-50 p-1.5 text-left text-[9px] text-red-800 shadow-md">
                      {unit.latePenalties.map((p) => (
                        <div key={p.weekIndex}>
                          Týden {p.weekIndex}: 5 (váha {p.weight})
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
        </td>

        {/* Actions */}
        <td className="px-3 py-2.5 text-right align-top" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onGrade}
            className="inline-flex items-center gap-1 rounded-md border border-subject/30 bg-subject-soft/40 px-2.5 py-1 text-xs font-semibold text-subject transition-colors hover:border-subject"
          >
            <GraduationCap className="h-3.5 w-3.5" /> Hodnotit
          </button>
        </td>
      </tr>

      {expanded && unit.versions.length > 0 && (
        <tr className="bg-muted/30">
          <td colSpan={5} className="px-6 py-3">
            <UnitVersions unit={unit} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Grade box — one value written to every member of the unit (shared grade). */
function GradeInput({
  assignmentId,
  userIds,
  initial,
}: {
  assignmentId: string;
  userIds: string[];
  initial: string | null;
}) {
  const router = useRouter();
  const save = useServerFn(updateSubmissionState);
  const [value, setValue] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = value !== (initial ?? "");

  const submit = async () => {
    setBusy(true);
    try {
      await save({
        data: {
          assignmentId,
          userIds,
          value: value || null,
          note: undefined,
          locked: undefined,
          extension: undefined,
        },
      });
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5 border-l border-border pl-3">
      <GraduationCap className="h-4 w-4 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="—"
        aria-label="Známka"
        className="w-12 rounded-md border border-input bg-background px-2 py-1 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
      />
      {dirty && (
        <button
          onClick={submit}
          disabled={busy}
          className="subject-button !px-2.5 !py-1 text-xs disabled:opacity-60"
        >
          {busy ? "…" : "✓"}
        </button>
      )}
    </span>
  );
}
