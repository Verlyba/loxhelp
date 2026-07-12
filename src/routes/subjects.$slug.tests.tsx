import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import {
  FileQuestion,
  Plus,
  Trash2,
  EyeOff,
  Clock,
  ChevronRight,
  BookOpen,
  ArrowLeft,
  X,
  Upload,
  Settings2,
  FileSpreadsheet,
  Users2,
  Download,
} from "lucide-react";
import { requireUser } from "@/lib/guards";
import { getTestsList } from "@/lib/test-data";
import { createTest, deleteTest } from "@/lib/test-actions";
import { getMoodleTests, getGradingSettings } from "@/lib/data";
import { importMoodleTest, deleteMoodleTest, updateGradingSettings } from "@/lib/actions";
import { useUser } from "@/lib/use-user";
import { isStaff } from "@/lib/roles";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";
import { ModalBackdrop } from "@/components/modal-backdrop";
import type { GradingSettingsView, MoodleTestSummary } from "@/lib/types";
import { downloadTextFile } from "@/lib/download";

export const Route = createFileRoute("/subjects/$slug/tests")({
  beforeLoad: ({ context }) => {
    requireUser(context.user);
  },
  loader: async ({ params }) => {
    const testsData = await getTestsList({ data: params.slug });
    const staffOnly = {
      moodleTests: [] as MoodleTestSummary[],
      gradingSettings: null as GradingSettingsView | null,
    };
    try {
      const [moodleTests, gradingSettings] = await Promise.all([
        getMoodleTests({ data: testsData.subjectId }),
        getGradingSettings({ data: testsData.subjectId }),
      ]);
      staffOnly.moodleTests = moodleTests;
      staffOnly.gradingSettings = gradingSettings;
    } catch {
      // student — the two calls above require staff, silently skip
    }
    return { ...testsData, ...staffOnly };
  },
  component: TestsListPage,
});

function TestsListPage() {
  const { slug } = Route.useParams();
  const { subjectName, tests, subjectId, moodleTests, gradingSettings } = Route.useLoaderData();
  const user = useUser();
  const staff = !!user && isStaff(user.role);

  // This route also parents /tests/$tid and /tests/moodle/$mtid — those are
  // full detail pages, not children shown alongside the list, so only render
  // the list here when this route is the exact match; otherwise just outlet.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isListView = pathname === `/subjects/${slug}/tests`;

  if (!isListView) return <Outlet />;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Testy a kvízy
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Přehled vědomostních testů pro předmět {subjectName}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {staff && gradingSettings && (
            <GradingSettingsModal subjectId={subjectId} settings={gradingSettings} />
          )}
          {staff && <ImportMoodleModal subjectId={subjectId} />}
          {staff && <CreateTestModal subjectId={subjectId} />}
        </div>
      </header>

      {tests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <FileQuestion className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h3 className="mt-4 text-sm font-semibold text-foreground">Žádné testy</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {staff
              ? "Vytvořte svůj první test kliknutím na tlačítko výše."
              : "V tomto předmětu zatím nebyly zadány žádné testy."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tests.map((t) => (
            <TestCard key={t.id} test={t} slug={slug} staff={staff} />
          ))}
        </div>
      )}

      {staff && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <FileSpreadsheet className="h-5 w-5 text-subject" /> Importované testy z Moodle
          </h3>
          {moodleTests.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              Zatím nebyl importován žádný soubor s výsledky.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {moodleTests.map((t) => (
                <MoodleTestCard key={t.id} test={t} slug={slug} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function MoodleTestCard({ test, slug }: { test: MoodleTestSummary; slug: string }) {
  const router = useRouter();
  const del = useServerFn(deleteMoodleTest);
  const { confirm } = useDialog();
  const [busy, setBusy] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirm({
      title: `Smazat import „${test.title}“?`,
      message: "Smažou se všechny naimportované výsledky tohoto testu. Akce je nevratná.",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await del({ data: test.id });
      toast.success("Import byl smazán.");
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smazání selhalo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Link
      to="/subjects/$slug/tests/moodle/$mtid"
      params={{ slug, mtid: test.id }}
      className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-subject/40"
    >
      <div className="min-w-0">
        <h4 className="font-display font-semibold text-sm text-foreground group-hover:text-subject transition-colors truncate">
          {test.title}
        </h4>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users2 className="h-3 w-3" /> {test.matchedCount}/{test.resultCount} přiřazeno
          </span>
          {test.avgGrade && <span>Ø {test.avgGrade}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={handleDelete}
          disabled={busy}
          aria-label="Smazat import"
          className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-60 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-subject group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}

function GradingSettingsModal({
  subjectId,
  settings,
}: {
  subjectId: string;
  settings: GradingSettingsView;
}) {
  const router = useRouter();
  const update = useServerFn(updateGradingSettings);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await update({ data: { subjectId, ...form } });
      toast.success("Nastavení hodnocení bylo uloženo.");
      setOpen(false);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uložení selhalo.");
    } finally {
      setBusy(false);
    }
  };

  const numField = (key: keyof typeof form) => (
    <input
      type="number"
      min={0}
      max={100}
      value={form[key] as number}
      onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
      className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-center text-foreground outline-none focus:ring-2 focus:ring-ring/40"
    />
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
      >
        <Settings2 className="h-4 w-4" /> Nastavení hodnocení
      </button>

      {open && (
        <ModalBackdrop
          onClose={() => setOpen(false)}
          ariaLabel="Nastavení hodnocení"
          className="flex items-center justify-center p-4 text-sm"
        >
          <form
            onSubmit={submit}
            className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-[var(--shadow-elevated)]"
          >
            <header className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
              <h3 className="font-display text-lg font-bold text-foreground">
                Nastavení hodnocení
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Zavřít"
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="grid gap-5 p-6">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Hranice pro automatické známkování importů z Moodle
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/80">
                  Minimální procento bodů pro danou známku (10 bodů = 100 %).
                </p>
                <div className="mt-2.5 grid grid-cols-4 gap-2">
                  {(["grade1Min", "grade2Min", "grade3Min", "grade4Min"] as const).map((key, i) => (
                    <label key={key} className="flex flex-col items-center gap-1">
                      <span className="text-xs font-bold text-subject">{i + 1}</span>
                      <div className="flex items-center gap-0.5">
                        {numField(key)}
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Pod nejnižší hranicí se automaticky přidělí známka 5.
                </p>
              </div>

              <div className="border-t border-border pt-4">
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={form.latePenaltyEnabled}
                    onChange={(e) => setForm({ ...form, latePenaltyEnabled: e.target.checked })}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      Penalizace za time management
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Neodevzdané úkoly po termínu automaticky dostávají další „5“ za každý započatý
                      týden prodlení — dokud nejsou odevzdané nebo oznámkované.
                    </span>
                  </span>
                </label>
                {form.latePenaltyEnabled && (
                  <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    Váha jedné penalizační pětky
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={form.latePenaltyWeight}
                      onChange={(e) =>
                        setForm({ ...form, latePenaltyWeight: Number(e.target.value) })
                      }
                      className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-center text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </label>
                )}
              </div>

              {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
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
                {busy ? "Ukládám…" : "Uložit"}
              </button>
            </footer>
          </form>
        </ModalBackdrop>
      )}
    </>
  );
}

function ImportMoodleModal({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const importFn = useServerFn(importMoodleTest);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Vyberte soubor s výsledky (.csv nebo .json).");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("subjectId", subjectId);
      fd.set("title", title);
      fd.set("file", file);
      const res = await importFn({ data: fd });
      toast.success(
        `Import hotov: ${res.matched}/${res.total} studentů přiřazeno${
          res.unmatched > 0 ? `, ${res.unmatched} nepřiřazeno` : ""
        }.`,
      );
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      setOpen(false);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import se nezdařil.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
      >
        <Upload className="h-4 w-4" /> Import z Moodle
      </button>

      {open && (
        <ModalBackdrop
          onClose={() => setOpen(false)}
          ariaLabel="Import výsledků z Moodle"
          className="flex items-center justify-center p-4 text-sm"
        >
          <form
            onSubmit={submit}
            className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-[var(--shadow-elevated)]"
          >
            <header className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
              <h3 className="font-display text-lg font-bold text-foreground">
                Import výsledků z Moodle
              </h3>
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
              <p className="text-xs text-muted-foreground">
                Nahrajte export výsledků testu z Moodle (CSV nebo JSON — v exportu Moodle zvolte
                „Hodnoty oddělené čárkou (.csv)“ nebo „Javascript Object Notation (.json)“).
                Studenty systém přiřadí podle e-mailu, známka 1–5 se dopočítá podle nastavených
                hranic.
              </p>

              <button
                type="button"
                onClick={() =>
                  downloadTextFile(
                    "vzor-import-moodle.csv",
                    "Příjmení;Jméno;E-mailová adresa;Zahájeno;Dokončeno;Doba trvání;Hodnocení/40,00\n" +
                      "Nováková;Anna;anna@school.cz;6. března 2026  11.30;6. března 2026  11.55;25 min. 4 sek.;34,50\n" +
                      "Kovář;Petr;petr@school.cz;6. března 2026  11.32;6. března 2026  12.01;29 min. 10 sek.;28,00\n",
                  )
                }
                className="inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Stáhnout vzorový soubor — použijte jako předlohu, např. pro AI převod vlastních dat do tohoto formátu"
              >
                <Download className="h-3.5 w-3.5" /> Vzorový soubor
              </button>

              <label className="block text-xs font-semibold text-muted-foreground">
                Název (nepovinné, jinak název souboru)
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Např. Základy, osvětlení, vytápění a stínění"
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                />
              </label>

              <label className="block text-xs font-semibold text-muted-foreground">
                Soubor s výsledky
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.json"
                  required
                  className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-subject file:px-3 file:py-2 file:text-sm file:font-medium file:text-[color:var(--subject-foreground)]"
                />
              </label>

              {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
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
                {busy ? "Importuji…" : "Importovat"}
              </button>
            </footer>
          </form>
        </ModalBackdrop>
      )}
    </>
  );
}

function TestCard({
  test,
  slug,
  staff,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  test: any;
  slug: string;
  staff: boolean;
}) {
  const router = useRouter();
  const del = useServerFn(deleteTest);
  const { confirm } = useDialog();
  const [busy, setBusy] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const ok = await confirm({
      title: `Smazat test „${test.title}“?`,
      message: "Dojde ke smazání všech otázek, možností a pokusů studentů. Tato akce je nevratná!",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await del({ data: test.id });
      toast.success("Test byl smazán.");
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smazání selhalo.");
    } finally {
      setBusy(false);
    }
  };

  const getStatusBadge = () => {
    if (staff) {
      return test.isPublished ? (
        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          Zveřejněno
        </span>
      ) : (
        <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
          Koncept
        </span>
      );
    }

    const att = test.myAttempt;
    if (!att) {
      return (
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          Nezačato
        </span>
      );
    }

    if (!att.submittedAt) {
      return (
        <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 animate-pulse">
          Rozpracováno
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          Odevzdáno {att.score !== null ? `(${att.score} b.)` : "(Čeká na ohodnocení)"}
        </span>
        {att.isLate && (
          <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 ring-1 ring-red-200 dark:bg-red-950/20 dark:text-red-400 dark:ring-red-900/30">
            Po limitu
          </span>
        )}
      </span>
    );
  };

  return (
    <Link
      to="/subjects/$slug/tests/$tid"
      params={{ slug, tid: test.id }}
      className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-subject/40 cursor-pointer"
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-subject" />
            <h3 className="font-display font-semibold text-base text-foreground group-hover:text-subject transition-colors">
              {test.title}
            </h3>
          </div>
          {getStatusBadge()}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {test.description || "Tento test nemá žádný doprovodný popis."}
        </p>
      </div>

      <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{test.questionCount} otázek</span>
          {test.timeLimit ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {test.timeLimit} min
            </span>
          ) : (
            <span>Bez limitu</span>
          )}
          {staff && <span>{test.attemptsCount} pokusů</span>}
        </div>

        <div className="flex items-center gap-2">
          {staff && (
            <button
              onClick={handleDelete}
              disabled={busy}
              aria-label="Smazat test"
              className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 disabled:opacity-60 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-subject group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

function CreateTestModal({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const create = useServerFn(createTest);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const parsedLimit = timeLimit ? parseInt(timeLimit, 10) : null;
    if (parsedLimit !== null && (isNaN(parsedLimit) || parsedLimit < 1)) {
      setError("Časový limit musí být kladné číslo.");
      setBusy(false);
      return;
    }

    try {
      const res = await create({
        data: {
          subjectId,
          title,
          description,
          timeLimit: parsedLimit,
        },
      });
      setTitle("");
      setDescription("");
      setTimeLimit("");
      setOpen(false);
      toast.success("Test byl vytvořen. Nyní přidejte otázky.");
      router.navigate({
        to: "/subjects/$slug/tests/$tid",
        params: { slug: router.state.location.pathname.split("/")[2], tid: res.id },
      });
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
        className="subject-button inline-flex items-center gap-1.5 shadow"
      >
        <Plus className="h-4 w-4" /> Nový test
      </button>

      {open && (
        <ModalBackdrop
          onClose={() => setOpen(false)}
          ariaLabel="Nový test"
          className="flex items-center justify-center p-4 text-sm"
        >
          <form
            onSubmit={submit}
            className="w-full max-w-lg rounded-2xl border border-border bg-surface shadow-[var(--shadow-elevated)]"
          >
            <header className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
              <h3 className="font-display text-lg font-bold text-foreground">Nový test</h3>
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
                Název testu
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Např. Test z Loxone zapojení"
                  required
                  autoFocus
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                />
              </label>

              <label className="block text-xs font-semibold text-muted-foreground">
                Popis testu
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Instrukce pro studenty..."
                  rows={3}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40 resize-none"
                />
              </label>

              <label className="block text-xs font-semibold text-muted-foreground">
                Časový limit (v minutách, nepovinné)
                <input
                  type="number"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  placeholder="Např. 30 (prázdné = bez limitu)"
                  min={1}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                />
              </label>

              {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
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
                {busy ? "Vytvářím…" : "Vytvořit test"}
              </button>
            </footer>
          </form>
        </ModalBackdrop>
      )}
    </>
  );
}
