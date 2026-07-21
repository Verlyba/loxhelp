import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Map, Plus, Pencil, Trash2, Copy, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { getRoadmap } from "@/lib/data";
import { importRoadmap, deleteRoadmap } from "@/lib/actions";
import { useUser } from "@/lib/use-user";
import { isStaff } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";
import { buildRoadmapPrompt, roadmapJsonTemplateText } from "@/lib/roadmap-prompt";
import { useDialog } from "@/components/dialog-provider";
import { ModalBackdrop } from "@/components/modal-backdrop";
import type { RoadmapView, SubjectDetail } from "@/lib/types";
import { toast } from "sonner";

const subjectRoute = getRouteApi("/subjects/$slug");

export const Route = createFileRoute("/subjects/$slug/roadmap")({
  beforeLoad: ({ context }) => {
    requireUser(context.user);
  },
  loader: ({ params }) => getRoadmap({ data: params.slug }),
  head: () => ({
    meta: [{ title: "Roadmapa — Shtroodle" }],
  }),
  component: RoadmapPage,
});

function RoadmapPage() {
  const roadmap = Route.useLoaderData() as RoadmapView | null;
  const subject = subjectRoute.useLoaderData() as SubjectDetail;
  const user = useUser();
  const staff = !!user && isStaff(user.role);
  const router = useRouter();
  const del = useServerFn(deleteRoadmap);
  const { confirm } = useDialog();
  const [editorOpen, setEditorOpen] = useState(false);

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Smazat roadmapu?",
      message: "Všechny tematické celky budou trvale smazány.",
      danger: true,
    });
    if (!ok) return;
    await del({ data: subject.id });
    await router.invalidate();
    toast.success("Roadmapa smazána.");
  };

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 flex items-center gap-2 font-display text-2xl font-semibold">
            <Map className="h-6 w-6 text-subject" /> Roadmapa
          </h2>
          <p className="text-sm text-muted-foreground">
            Přehled tematických celků podle ŠVP — co se probírá a co má žák umět.
          </p>
        </div>
        {staff && (
          <div className="flex shrink-0 items-center gap-2">
            {roadmap && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" /> Smazat
              </button>
            )}
            <button
              onClick={() => setEditorOpen(true)}
              className="subject-button inline-flex items-center gap-1.5"
            >
              {roadmap ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {roadmap ? "Upravit roadmapu" : "Vytvořit roadmapu"}
            </button>
          </div>
        )}
      </div>

      {!roadmap ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {staff
            ? 'Tento předmět ještě nemá roadmapu. Klikněte na "Vytvořit roadmapu".'
            : "Učitel ještě pro tento předmět roadmapu nepřidal."}
        </p>
      ) : (
        <div>
          <p className="mb-4 text-xs text-muted-foreground">
            {roadmap.gradeLabel}
            {roadmap.partLabel ? ` · ${roadmap.partLabel}` : ""} · aktualizováno{" "}
            {formatDateTime(roadmap.updatedAt)}
          </p>
          <ol className="grid gap-3">
            {roadmap.topics.map((t, i) => (
              <li key={t.id} className="surface-card p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-subject-soft text-xs font-bold text-subject ring-1 ring-subject/30">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display font-semibold text-foreground">{t.title}</h3>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Co se probírá
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/90">
                          {t.covers}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Co má žák umět
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/90">
                          {t.outcomes}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {editorOpen && (
        <RoadmapEditorModal subjectId={subject.id} onClose={() => setEditorOpen(false)} />
      )}
    </section>
  );
}

function RoadmapEditorModal({ subjectId, onClose }: { subjectId: string; onClose: () => void }) {
  const router = useRouter();
  const importFn = useServerFn(importRoadmap);
  const subject = subjectRoute.useLoaderData() as SubjectDetail;

  const [step, setStep] = useState<"prompt" | "paste">("prompt");
  const [subjectName, setSubjectName] = useState(subject.name);
  const [part, setPart] = useState("");
  const [grade, setGrade] = useState("");
  const [resultText, setResultText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prompt = buildRoadmapPrompt(subjectName, part, grade);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Zkopírováno.");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(resultText);
    } catch {
      setError("Vložený text není platný JSON.");
      return;
    }
    const topics = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { topics?: unknown })?.topics)
        ? (parsed as { topics: unknown[] }).topics
        : null;
    if (!topics) {
      setError('JSON musí být pole, nebo objekt s polem "topics".');
      return;
    }

    setBusy(true);
    try {
      await importFn({
        data: {
          subjectId,
          gradeLabel: grade || "—",
          partLabel: part || undefined,
          topics: topics as { title: string; covers: string; outcomes: string }[],
        },
      });
      await router.invalidate();
      toast.success("Roadmapa uložena.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uložení se nezdařilo — zkontrolujte formát.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose} ariaLabel="Vytvořit roadmapu">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-[var(--shadow-elevated)]">
        <header className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <h3 className="font-display text-lg font-bold text-foreground">Roadmapa ze ŠVP</h3>
        </header>

        {step === "prompt" ? (
          <div className="grid gap-4 p-6">
            <p className="text-sm text-muted-foreground">
              Vyplňte předmět, případně jeho část a ročník. Vygeneruje se prompt, který zkopírujete
              společně s přiloženým ŠVP dokumentem (PDF) do libovolné AI a výsledek pak vložíte
              zpět.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-xs font-semibold text-muted-foreground">
                Předmět
                <input
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                />
              </label>
              <label className="block text-xs font-semibold text-muted-foreground">
                Část (nepovinné)
                <input
                  value={part}
                  onChange={(e) => setPart(e.target.value)}
                  placeholder="např. praktická část"
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                />
              </label>
              <label className="block text-xs font-semibold text-muted-foreground">
                Ročník
                <input
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  required
                  placeholder="např. 2. ročník"
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                />
              </label>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Prompt (obsahuje i JSON šablonu)
                </span>
                <button
                  type="button"
                  onClick={() => copy(prompt)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] hover:bg-accent"
                >
                  <Copy className="h-3 w-3" /> Kopírovat prompt
                </button>
              </div>
              <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-relaxed text-foreground">
                {prompt}
              </pre>
              <button
                type="button"
                onClick={() => copy(roadmapJsonTemplateText())}
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] hover:bg-accent"
              >
                <Copy className="h-3 w-3" /> Kopírovat jen JSON šablonu
              </button>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Storno
              </button>
              <button
                type="button"
                disabled={!grade.trim()}
                onClick={() => setStep("paste")}
                className="subject-button inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Mám výsledek od AI <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4 p-6">
            <p className="text-sm text-muted-foreground">
              Vložte JSON, který vám vrátila AI (podle šablony), a uložte.
            </p>
            <textarea
              value={resultText}
              onChange={(e) => setResultText(e.target.value)}
              rows={12}
              autoFocus
              placeholder='{"topics": [{"title": "...", "covers": "...", "outcomes": "..."}]}'
              className="mono w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-ring/40"
            />
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setStep("prompt")}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Zpět
              </button>
              <button
                type="submit"
                disabled={busy || !resultText.trim()}
                className="subject-button rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {busy ? "Ukládám…" : "Uložit roadmapu"}
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalBackdrop>
  );
}
