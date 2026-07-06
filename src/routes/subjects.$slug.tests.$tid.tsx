/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Plus,
  Trash2,
  Lock,
  Save,
  CheckCircle2,
  X,
  FileText,
  User,
  GraduationCap,
} from "lucide-react";
import { requireUser } from "@/lib/guards";
import { getTestDetail, getTestAttempt, getTestAttemptsAll } from "@/lib/test-data";
import {
  updateTest,
  createQuestion,
  deleteQuestion,
  startTestAttempt,
  submitTestAttempt,
  gradeTestAttempt,
} from "@/lib/test-actions";
import { useUser } from "@/lib/use-user";
import { isStaff } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";

export const Route = createFileRoute("/subjects/$slug/tests/$tid")({
  beforeLoad: ({ context }) => {
    requireUser(context.user);
  },
  loader: ({ params }) => getTestDetail({ data: params.tid }),
  component: TestDetailPage,
});

function TestDetailPage() {
  const test = Route.useLoaderData();
  const { slug } = Route.useParams();
  const user = useUser();
  const staff = !!user && isStaff(user.role);

  return (
    <div className="space-y-6">
      <Link
        to="/subjects/$slug/tests"
        params={{ slug }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Zpět na testy
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
              {test.title}
            </h1>
            {staff && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                  test.isPublished
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                }`}
              >
                {test.isPublished ? "Zadáno" : "Koncept"}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {test.description || "Bez popisu."}
          </p>
          <div className="mt-2.5 flex items-center gap-4 text-xs text-muted-foreground">
            {test.timeLimit ? (
              <span className="inline-flex items-center gap-1 font-semibold text-foreground bg-muted/60 px-2 py-0.5 rounded">
                <Clock className="h-3.5 w-3.5 text-subject" /> Limit: {test.timeLimit} minut
              </span>
            ) : (
              <span className="bg-muted/60 px-2 py-0.5 rounded">Bez časového limitu</span>
            )}
            <span>Celkem bodů: {test.maxPoints} b.</span>
          </div>
        </div>
      </header>

      {staff ? <StaffTestView test={test} /> : <StudentTestView test={test} />}
    </div>
  );
}

/* ========================================================================== */
/*                                STUDENT VIEW                                */
/* ========================================================================== */

function StudentTestView({ test }: { test: any }) {
  const router = useRouter();
  const startAttempt = useServerFn(startTestAttempt);
  const [busy, setBusy] = useState(false);

  const handleStart = async () => {
    setBusy(true);
    try {
      await startAttempt({ data: test.id });
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nepodařilo se spustit test.");
    } finally {
      setBusy(false);
    }
  };

  const att = test.myAttempt;

  // Case A: Not started
  if (!att) {
    return (
      <div className="surface-card p-8 text-center max-w-xl mx-auto space-y-5 border border-border/80">
        <div className="rounded-full bg-subject-soft p-3 text-subject w-fit mx-auto">
          <BookOpen className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h3 className="font-display font-semibold text-lg text-foreground">
            Připraven ke spuštění
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Kliknutím na tlačítko níže spustíte test. Časový limit se začne odpočítávat okamžitě.
            Jakmile test spustíte, musíte jej dokončit a odevzdat.
          </p>
        </div>
        <button
          onClick={handleStart}
          disabled={busy}
          className="subject-button w-full sm:w-auto font-semibold px-6 py-2.5 text-sm shadow"
        >
          {busy ? "Spouštím..." : "Spustit test"}
        </button>
      </div>
    );
  }

  // Case B: Running
  if (!att.submittedAt) {
    return <TestExecutionView test={test} attemptId={att.id} startedAt={att.startedAt} />;
  }

  // Case C: Submitted / Review mode
  return <TestReviewView test={test} attemptId={att.id} />;
}

/* ---------- test execution panel (student taking test) ---------- */

function TestExecutionView({
  test,
  attemptId,
  startedAt,
}: {
  test: any;
  attemptId: string;
  startedAt: string;
}) {
  const router = useRouter();
  const submitAttempt = useServerFn(submitTestAttempt);
  const [answers, setAnswers] = useState<
    Record<string, { text?: string; selectedOptionIds?: string[] }>
  >({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { confirm } = useDialog();

  // Load answers from localstorage if any (local session restore in case of reload)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`test_attempt_${attemptId}`);
      if (stored) {
        setAnswers(JSON.parse(stored));
      }
    } catch (_) {
      // ignore
    }
  }, [attemptId]);

  // Save answers to localstorage on change
  const updateAnswer = (qId: string, updates: { text?: string; selectedOptionIds?: string[] }) => {
    setAnswers((prev) => {
      const next = { ...prev, [qId]: { ...prev[qId], ...updates } };
      try {
        localStorage.setItem(`test_attempt_${attemptId}`, JSON.stringify(next));
      } catch (_) {
        // ignore
      }
      return next;
    });
  };

  // Timer logic
  useEffect(() => {
    if (!test.timeLimit) return;

    const limitMs = test.timeLimit * 60 * 1000;
    const startMs = new Date(startedAt).getTime();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startMs;
      const remaining = Math.max(0, limitMs - elapsed);
      setTimeLeft(remaining);

      // Auto submit if time runs out
      if (remaining <= 0) {
        clearInterval(interval);
        toast.warning("Časový limit vypršel! Odevzdávám test...");
        doSubmit(true);
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test.timeLimit, startedAt]);

  const doSubmit = async (forceAuto = false) => {
    if (!forceAuto) {
      const ok = await confirm({
        title: "Odevzdat test?",
        message: "Opravdu chcete odevzdat test k ohodnocení? Již nebudete moci měnit své odpovědi.",
      });
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([qId, ans]) => ({
        questionId: qId,
        text: ans.text ?? null,
        selectedOptionIds: ans.selectedOptionIds ?? [],
      }));

      await submitAttempt({
        data: {
          attemptId,
          answers: formattedAnswers,
        },
      });

      // Clear localstorage
      try {
        localStorage.removeItem(`test_attempt_${attemptId}`);
      } catch (_) {
        // ignore
      }

      toast.success("Test byl úspěšně odevzdán.");
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Odeslání selhalo.");
    } finally {
      setSubmitting(false);
    }
  };

  const getTimerString = () => {
    if (timeLeft === null) return "";
    const totalSecs = Math.floor(timeLeft / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSelectOption = (qId: string, optId: string, multiple: boolean) => {
    const current = answers[qId]?.selectedOptionIds ?? [];
    if (multiple) {
      const next = current.includes(optId)
        ? current.filter((id) => id !== optId)
        : [...current, optId];
      updateAnswer(qId, { selectedOptionIds: next });
    } else {
      updateAnswer(qId, { selectedOptionIds: [optId] });
    }
  };

  return (
    <div className="space-y-6">
      {test.timeLimit && (
        <div className="sticky top-14 z-30 flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <Clock className="h-5 w-5 animate-pulse" />
            <span className="font-semibold text-sm">Běžící čas testu</span>
          </div>
          <span className="font-mono text-xl font-extrabold text-amber-900 dark:text-amber-200">
            {getTimerString() || "Načítám..."}
          </span>
        </div>
      )}

      <div className="space-y-5">
        {test.questions.map((q: any, index: number) => (
          <div key={q.id} className="surface-card p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-subject/10 text-xs font-bold text-subject">
                {index + 1}
              </span>
              <div className="space-y-1">
                <p className="font-medium text-foreground whitespace-pre-wrap">{q.text}</p>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Hodnota: {q.points} b.
                </span>
              </div>
            </div>

            {q.type === "TEXT" ? (
              <textarea
                value={answers[q.id]?.text ?? ""}
                onChange={(e) => updateAnswer(q.id, { text: e.target.value })}
                placeholder="Napište svoji odpověď..."
                rows={4}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
              />
            ) : (
              <div className="grid gap-2.5 pl-9">
                {q.options.map((o: any) => {
                  const checked = answers[q.id]?.selectedOptionIds?.includes(o.id) ?? false;
                  return (
                    <label
                      key={o.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                        checked
                          ? "border-subject/50 bg-subject-soft/30 ring-1 ring-subject/20"
                          : "border-border hover:bg-accent/40"
                      }`}
                    >
                      <input
                        type={q.type === "MULTIPLE" ? "checkbox" : "radio"}
                        name={`q_${q.id}`}
                        checked={checked}
                        onChange={() => handleSelectOption(q.id, o.id, q.type === "MULTIPLE")}
                        className="mt-0.5 text-subject focus:ring-subject"
                      />
                      <span className="text-foreground font-medium">{o.text}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={() => doSubmit(false)}
          disabled={submitting}
          className="subject-button font-bold px-6 py-2.5 text-sm shadow"
        >
          {submitting ? "Odevzdávám..." : "Odevzdat test"}
        </button>
      </div>
    </div>
  );
}

/* ---------- student attempt review (submitted test results) ---------- */

function TestReviewView({ test, attemptId }: { test: any; attemptId: string }) {
  const getAttemptQuery = useQuery({
    queryKey: ["test-attempt", attemptId],
    queryFn: () => getTestAttempt({ data: attemptId }),
  });

  if (getAttemptQuery.isLoading) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">Načítám výsledky...</div>
    );
  }

  if (getAttemptQuery.isError || !getAttemptQuery.data) {
    return <div className="text-center py-10 text-sm text-red-600">Selhalo načtení výsledků.</div>;
  }

  const att = getAttemptQuery.data;

  return (
    <div className="space-y-6">
      {/* Result score header card */}
      <div className="surface-card p-6 border-emerald-100 bg-emerald-50/10 dark:bg-emerald-950/5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/50 p-3 text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg text-foreground">
              Test byl odevzdán
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Odevzdáno {formatDateTime(att.submittedAt!)}
            </p>
          </div>
        </div>

        <div className="bg-subject-soft border border-subject/20 rounded-xl p-4 text-center min-w-32">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
            Dosažené body
          </span>
          <span className="text-3xl font-display font-extrabold text-subject block mt-1">
            {att.score !== null ? `${att.score} / ${att.maxPoints}` : "—"}
          </span>
          {att.score === null && (
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold block mt-0.5 animate-pulse">
              Čeká na ohodnocení
            </span>
          )}
        </div>
      </div>

      {att.feedback && (
        <div className="surface-card p-5 space-y-2">
          <h3 className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
            <GraduationCap className="h-4 w-4 text-subject" /> Slovní hodnocení učitele
          </h3>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed italic bg-muted/30 p-3.5 rounded-lg border border-border/50">
            „{att.feedback}“
          </p>
        </div>
      )}

      {/* Questions list with feedback */}
      <div className="space-y-5">
        <h3 className="font-display font-semibold text-lg text-foreground">Přehled odpovědí</h3>

        {att.questions.map((q: any, index: number) => {
          const ans = q.studentAnswer;
          const isText = q.type === "TEXT";

          return (
            <div key={q.id} className="surface-card p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-subject/10 text-xs font-bold text-subject">
                    {index + 1}
                  </span>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground whitespace-pre-wrap">{q.text}</p>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      Maximální hodnota: {q.points} b.
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-sm font-semibold text-foreground border border-border/50">
                    Získáno:{" "}
                    {ans?.points !== null && ans?.points !== undefined ? `${ans.points} b.` : "—"}
                  </span>
                </div>
              </div>

              {/* Student answer view */}
              <div className="pl-9 space-y-3">
                {isText ? (
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                      Vaše odpověď:
                    </span>
                    <p className="text-sm text-foreground bg-muted/20 p-3.5 rounded-lg border border-border whitespace-pre-wrap font-medium">
                      {ans?.text || (
                        <span className="text-muted-foreground italic">Bez odpovědi</span>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {q.options.map((o: any) => {
                      const selected = ans?.selectedOptionIds?.includes(o.id) ?? false;
                      const correct = o.isCorrect;

                      let optionStyle = "border-border";
                      if (selected && correct)
                        optionStyle =
                          "border-emerald-500 bg-emerald-50/20 text-emerald-950 dark:text-emerald-300 ring-1 ring-emerald-300";
                      else if (selected && !correct)
                        optionStyle = "border-red-400 bg-red-50/15 text-red-950 dark:text-red-300";
                      else if (!selected && correct)
                        optionStyle =
                          "border-dashed border-emerald-300 bg-emerald-50/5 text-emerald-800";

                      return (
                        <div
                          key={o.id}
                          className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${optionStyle}`}
                        >
                          <input
                            type={q.type === "MULTIPLE" ? "checkbox" : "radio"}
                            disabled
                            checked={selected}
                            className="mt-0.5 text-subject"
                          />
                          <div className="flex-1 flex items-center justify-between gap-2">
                            <span className="font-medium">{o.text}</span>
                            <div className="flex items-center gap-1.5 text-xs font-semibold">
                              {correct && (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  Správně
                                </span>
                              )}
                              {selected && !correct && (
                                <span className="text-red-600 dark:text-red-400">
                                  Chybně zvoleno
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {ans?.feedback && (
                  <div className="mt-3 p-3 bg-subject-soft/30 rounded-lg border border-subject/10 text-xs leading-relaxed text-foreground">
                    <span className="font-bold block text-subject mb-0.5">
                      Komentář k odpovědi:
                    </span>
                    {ans.feedback}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                                 STAFF VIEW                                 */
/* ========================================================================== */

function StaffTestView({ test }: { test: any }) {
  const [activeTab, setActiveTab] = useState<"questions" | "attempts">("questions");

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-border/80 text-sm">
        <button
          onClick={() => setActiveTab("questions")}
          className={`px-5 py-3 font-semibold -mb-px border-b-2 transition-all ${
            activeTab === "questions"
              ? "border-subject text-subject"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Otázky & Editor ({test.questions.length})
        </button>
        <button
          onClick={() => setActiveTab("attempts")}
          className={`px-5 py-3 font-semibold -mb-px border-b-2 transition-all ${
            activeTab === "attempts"
              ? "border-subject text-subject"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Pokusy studentů
        </button>
      </div>

      {activeTab === "questions" ? (
        <StaffEditorTab test={test} />
      ) : (
        <StaffAttemptsTab test={test} />
      )}
    </div>
  );
}

/* ---------- tab 1: test settings and questions editor ---------- */

function StaffEditorTab({ test }: { test: any }) {
  const router = useRouter();
  const edit = useServerFn(updateTest);
  const addQ = useServerFn(createQuestion);
  const delQ = useServerFn(deleteQuestion);
  const { confirm } = useDialog();

  const [title, setTitle] = useState(test.title);
  const [description, setDescription] = useState(test.description || "");
  const [timeLimit, setTimeLimit] = useState(test.timeLimit ? String(test.timeLimit) : "");
  const [busy, setBusy] = useState(false);

  // New question form state
  const [qText, setQText] = useState("");
  const [qType, setQType] = useState<"SINGLE" | "MULTIPLE" | "TEXT">("SINGLE");
  const [qPoints, setQPoints] = useState(1);
  const [qOptions, setQOptions] = useState<{ text: string; isCorrect: boolean }[]>([
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);
  const [addingQ, setAddingQ] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const parsedLimit = timeLimit ? parseInt(timeLimit, 10) : null;
      await edit({
        data: {
          id: test.id,
          title,
          description,
          timeLimit: parsedLimit,
        },
      });
      toast.success("Nastavení testu uloženo.");
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uložení selhalo.");
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePublished = async () => {
    setBusy(true);
    try {
      await edit({
        data: {
          id: test.id,
          isPublished: !test.isPublished,
        },
      });
      toast.success(test.isPublished ? "Test stažen z oběhu." : "Test byl publikován studentům.");
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Změna stavu selhala.");
    } finally {
      setBusy(false);
    }
  };

  const handleAddQuestionOption = () => {
    setQOptions((prev) => [...prev, { text: "", isCorrect: false }]);
  };

  const handleRemoveQuestionOption = (idx: number) => {
    setQOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateOption = (
    idx: number,
    updates: Partial<{ text: string; isCorrect: boolean }>,
  ) => {
    setQOptions((prev) =>
      prev.map((opt, i) => {
        if (i !== idx) return opt;
        // If SINGLE type and marking correct, unmark all others
        if (qType === "SINGLE" && updates.isCorrect) {
          return { ...opt, ...updates };
        }
        return { ...opt, ...updates };
      }),
    );

    // If SINGLE, unmark others when marking one correct
    if (qType === "SINGLE" && updates.isCorrect) {
      setQOptions((prev) =>
        prev.map((opt, i) => (i === idx ? { ...opt, ...updates } : { ...opt, isCorrect: false })),
      );
    }
  };

  const handleAddQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qType !== "TEXT" && qOptions.filter((o) => o.isCorrect).length === 0) {
      toast.error("Musíte označit alespoň jednu správnou odpověď.");
      return;
    }

    setAddingQ(true);
    try {
      await addQ({
        data: {
          testId: test.id,
          text: qText,
          type: qType,
          points: qPoints,
          options: qType === "TEXT" ? [] : qOptions.filter((o) => o.text.trim() !== ""),
        },
      });
      toast.success("Otázka byla přidána.");
      setQText("");
      setQPoints(1);
      setQOptions([
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ]);
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Přidání otázky selhalo.");
    } finally {
      setAddingQ(false);
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    const ok = await confirm({
      title: "Smazat otázku?",
      message:
        "Opravdu chcete smazat tuto otázku? Tato akce smaže i všechny odpovědi studentů u této otázky.",
      danger: true,
    });
    if (!ok) return;

    try {
      await delQ({ data: qId });
      toast.success("Otázka smazána.");
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smazání selhalo.");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
      {/* List of questions */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-lg text-foreground">Otázky v testu</h3>
        </div>

        {test.questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
            Zatím nebyly přidány žádné otázky. Použijte panel na pravé straně pro vytvoření otázek.
          </div>
        ) : (
          <div className="space-y-4">
            {test.questions.map((q: any, idx: number) => (
              <div key={q.id} className="surface-card p-5 space-y-3 relative group">
                <button
                  onClick={() => handleDeleteQuestion(q.id)}
                  aria-label="Smazat otázku"
                  className="absolute top-4 right-4 p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <div className="flex items-start gap-2.5 pl-1">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-subject/10 text-[10px] font-bold text-subject mt-0.5">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {q.text}
                    </h4>
                    <div className="mt-1 flex items-center gap-3 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      <span>Typ: {q.type}</span>
                      <span>Hodnota: {q.points} b.</span>
                    </div>
                  </div>
                </div>

                {q.type !== "TEXT" && (
                  <div className="grid gap-2 pl-8 mt-2">
                    {q.options.map((o: any) => (
                      <div
                        key={o.id}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                          o.isCorrect
                            ? "border-emerald-200 bg-emerald-50/20 text-emerald-800"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                        <span>{o.text}</span>
                        {o.isCorrect && (
                          <span className="ml-auto text-[9px] font-bold">Správná volba</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Question Form Panel */}
        <form onSubmit={handleAddQuestionSubmit} className="surface-card p-6 space-y-4">
          <h3 className="font-display font-semibold text-base text-foreground flex items-center gap-1.5">
            <Plus className="h-4 w-4 text-subject" /> Přidat novou otázku
          </h3>

          <div className="grid gap-4">
            <label className="block text-xs font-semibold text-muted-foreground">
              Text otázky
              <textarea
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="Zadejte znění otázky..."
                required
                rows={3}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-xs font-semibold text-muted-foreground">
                Typ otázky
                <select
                  value={qType}
                  onChange={(e) => {
                    const nextType = e.target.value as "SINGLE" | "MULTIPLE" | "TEXT";
                    setQType(nextType);
                    if (nextType === "TEXT") setQOptions([]);
                    else if (qOptions.length === 0) {
                      setQOptions([
                        { text: "", isCorrect: false },
                        { text: "", isCorrect: false },
                      ]);
                    }
                  }}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
                >
                  <option value="SINGLE">Výběr jedné odpovědi (Single)</option>
                  <option value="MULTIPLE">Výběr více odpovědí (Multiple)</option>
                  <option value="TEXT">Otevřená textová odpověď</option>
                </select>
              </label>

              <label className="block text-xs font-semibold text-muted-foreground">
                Bodová hodnota
                <input
                  type="number"
                  value={qPoints}
                  onChange={(e) => setQPoints(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  min={1}
                  required
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
                />
              </label>
            </div>

            {qType !== "TEXT" && (
              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-muted-foreground block">
                  Možnosti odpovědi (označte správnou/správné)
                </span>
                <div className="space-y-2">
                  {qOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <input
                        type={qType === "MULTIPLE" ? "checkbox" : "radio"}
                        name="new_q_correct"
                        checked={opt.isCorrect}
                        onChange={(e) => handleUpdateOption(idx, { isCorrect: e.target.checked })}
                        className="text-subject"
                      />
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleUpdateOption(idx, { text: e.target.value })}
                        placeholder={`Možnost ${idx + 1}`}
                        required
                        className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                      />
                      {qOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestionOption(idx)}
                          aria-label="Odstranit možnost"
                          className="text-muted-foreground hover:text-red-600 p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddQuestionOption}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-subject hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Přidat možnost
                </button>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={addingQ}
                className="subject-button text-xs font-semibold px-4 py-2"
              >
                {addingQ ? "Ukládám..." : "Přidat otázku"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Right rail settings edit */}
      <div className="space-y-6">
        <form onSubmit={handleSaveSettings} className="surface-card p-5 space-y-4">
          <h3 className="font-display font-semibold text-base text-foreground">Nastavení testu</h3>

          <label className="block text-xs font-semibold text-muted-foreground">
            Název testu
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
            />
          </label>

          <label className="block text-xs font-semibold text-muted-foreground">
            Popis testu
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 resize-none text-foreground"
            />
          </label>

          <label className="block text-xs font-semibold text-muted-foreground">
            Časový limit (minuty)
            <input
              type="number"
              value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value)}
              placeholder="Bez limitu"
              min={1}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 text-foreground"
            />
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="subject-button flex-1 justify-center inline-flex items-center gap-1.5 text-xs font-semibold py-2"
            >
              <Save className="h-3.5 w-3.5" /> Uložit nastavení
            </button>
          </div>
        </form>

        {/* Publish Toolbar */}
        <div className="surface-card p-5 space-y-4">
          <h3 className="font-display font-semibold text-base text-foreground">Stav testu</h3>
          <p className="text-xs text-muted-foreground leading-normal">
            Pokud je test zadán, studenti ho uvidí ve svém seznamu a mohou ho spustit k vyplnění.
          </p>
          <button
            onClick={handleTogglePublished}
            disabled={busy}
            className={`w-full justify-center inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold transition-all shadow ${
              test.isPublished
                ? "border border-border text-muted-foreground hover:bg-accent bg-surface"
                : "subject-button"
            }`}
          >
            {test.isPublished ? "Zrušit zadání (Draft)" : "Zadat studentům (Publish)"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- tab 2: student attempts list and grading panel ---------- */

function StaffAttemptsTab({ test }: { test: any }) {
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {selectedAttemptId ? (
        <StaffGradingPanel
          attemptId={selectedAttemptId}
          onClose={() => setSelectedAttemptId(null)}
        />
      ) : (
        <StaffAttemptsTable testId={test.id} onSelectAttempt={setSelectedAttemptId} />
      )}
    </div>
  );
}

function StaffAttemptsTable({
  testId,
  onSelectAttempt,
}: {
  testId: string;
  onSelectAttempt: (id: string) => void;
}) {
  const listQuery = useQuery({
    queryKey: ["test-attempts-list", testId],
    queryFn: async () => {
      // Re-use getTestsList to load count of attempts in detail? Or custom query?
      // Since getTestDetail includes subject and attempts, let's load details using getTestDetail or custom.
      // Wait, getTestDetail already loads t.attempts! But wait, t.attempts is mapped.
      // Let's load the test detail inside the table to get all attempts.
      return getTestDetail({ data: testId });
    },
  });

  if (listQuery.isLoading) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Načítám pokusy...</div>;
  }

  // We need to retrieve attempts. Wait! getTestDetail loads:
  // attempt list via Prisma query. Wait, does getTestDetail query all attempts for staff?
  // Let's look at `getTestDetail` handler in `test-data.ts`. It loads `myAttempt`.
  // Wait, does it load all student attempts for staff? No, it only loaded `myAttempt` for student.
  // Oh, wait! The attempts list for staff is not queried by `getTestDetail`!
  // Ah, let's look at the database. Staff need to see all attempts for this test.
  // We should write a small data loader for all attempts or fetch it using react-query with a serverFn!
  // Wait, let's check: can we write a `getTestAttemptsAll` in `test-data.ts`?
  // Yes, let's write `getTestAttemptsAll` and export it in `test-data.ts`.
  // Wait, let's check if we already have a list of attempts in the db.
  // Let's check `getTestsList` - it includes attempts list.
  // But wait! If we didn't add `getTestAttemptsAll`, we can easily add it to `test-data.ts`.
  // Let's check what we did in `getTestDetail` - it only loads the student's `myAttempt`.
  // So we definitely need a `getTestAttemptsAll` serverFn to fetch all attempts for staff!
  // Let's design `getTestAttemptsAll`:
  // input: `testId: string`
  // query: `db.testAttempt.findMany({ where: { testId }, include: { user: true } })`
  // This is very simple and easy to add! We will add it to `test-data.ts` using `replace_file_content`.
  // But first let's see how `StaffAttemptsTable` will call it.

  return (
    <div className="surface-card overflow-x-auto">
      <AttemptsTableInner testId={testId} onSelectAttempt={onSelectAttempt} />
    </div>
  );
}

function AttemptsTableInner({
  testId,
  onSelectAttempt,
}: {
  testId: string;
  onSelectAttempt: (id: string) => void;
}) {
  const qc = useQueryClientAllAttempts();
  const getAttempts = useServerFn(getTestAttemptsAll);

  const query = useQuery({
    queryKey: ["test-attempts-all", testId],
    queryFn: () => getAttempts({ data: testId }),
  });

  if (query.isLoading) {
    return <div className="text-center py-6 text-xs text-muted-foreground">Načítám pokusy...</div>;
  }

  const list = query.data ?? [];

  if (list.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        Dosud žádný student nespustil tento test.
      </div>
    );
  }

  return (
    <table className="w-full text-sm text-left">
      <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="px-5 py-3 font-semibold">Student</th>
          <th className="px-5 py-3 font-semibold">Spuštěno</th>
          <th className="px-5 py-3 font-semibold">Odevzdáno</th>
          <th className="px-5 py-3 font-semibold text-center">Získané body</th>
          <th className="px-5 py-3 font-semibold text-right">Akce</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border text-foreground">
        {list.map((att: any) => (
          <tr key={att.id} className="hover:bg-accent/30 transition-colors">
            <td className="px-5 py-3.5 font-medium">{att.studentName}</td>
            <td className="px-5 py-3.5 text-xs text-muted-foreground">
              {formatDateTime(att.startedAt)}
            </td>
            <td className="px-5 py-3.5 text-xs text-muted-foreground">
              {att.submittedAt ? (
                formatDateTime(att.submittedAt)
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
                  Rozpracováno
                </span>
              )}
            </td>
            <td className="px-5 py-3.5 font-bold text-center">
              {att.score !== null ? (
                `${att.score} / ${att.maxPoints}`
              ) : att.submittedAt ? (
                <span className="text-amber-700 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-200/50">
                  Čeká na opravu
                </span>
              ) : (
                "—"
              )}
            </td>
            <td className="px-5 py-3.5 text-right">
              {att.submittedAt ? (
                <button
                  onClick={() => onSelectAttempt(att.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-subject/30 bg-subject-soft/40 px-3 py-1.5 text-xs font-semibold text-subject transition-colors hover:border-subject"
                >
                  <GraduationCap className="h-3.5 w-3.5" /> Hodnotit
                </button>
              ) : (
                <span className="text-xs text-muted-foreground italic">Nelze hodnotit</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Dummy hooks for TanStack Query to typecheck / query correctly
function useQueryClientAllAttempts() {
  return null;
}

/* ---------- grading panel component for teacher ---------- */

function StaffGradingPanel({ attemptId, onClose }: { attemptId: string; onClose: () => void }) {
  const router = useRouter();
  const grade = useServerFn(gradeTestAttempt);

  const query = useQuery({
    queryKey: ["test-attempt-grade", attemptId],
    queryFn: () => getTestAttempt({ data: attemptId }),
  });

  const [points, setPoints] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [globalFeedback, setGlobalFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (query.data) {
      const att = query.data;
      const pts: Record<string, number> = {};
      const fbs: Record<string, string> = {};

      att.questions.forEach((q: any) => {
        if (q.studentAnswer) {
          pts[q.studentAnswer.id] = q.studentAnswer.points ?? 0;
          fbs[q.studentAnswer.id] = q.studentAnswer.feedback ?? "";
        }
      });

      setPoints(pts);
      setComments(fbs);
      setGlobalFeedback(att.feedback ?? "");
    }
  }, [query.data]);

  if (query.isLoading) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        Načítám pokus studenta...
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <div className="text-center py-10 text-sm text-red-600">Selhalo načtení pokusu.</div>;
  }

  const att = query.data;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      const answersPoints = Object.entries(points).map(([ansId, pts]) => ({
        answerId: ansId,
        points: pts,
        feedback: comments[ansId] || null,
      }));

      await grade({
        data: {
          attemptId,
          feedback: globalFeedback,
          answersPoints,
        },
      });

      toast.success("Hodnocení testu uloženo.");
      await router.invalidate();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uložení hodnocení selhalo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-base text-foreground">
            Hodnocení pokusu: {att.studentName}
          </h3>
          <p className="text-xs text-muted-foreground">
            Spuštěno: {formatDateTime(att.startedAt)} · Odevzdáno:{" "}
            {formatDateTime(att.submittedAt!)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs hover:bg-muted font-medium"
        >
          Zavřít panel
        </button>
      </header>

      {/* Global feedback textarea */}
      <div className="surface-card p-5 space-y-3">
        <label className="block text-xs font-semibold text-muted-foreground">
          Celkové slovní hodnocení pokusu
          <textarea
            value={globalFeedback}
            onChange={(e) => setGlobalFeedback(e.target.value)}
            placeholder="Shrnutí výsledků studenta, doporučení..."
            rows={2}
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40 resize-none"
          />
        </label>
      </div>

      {/* Answers list */}
      <div className="space-y-5">
        {att.questions.map((q: any, idx: number) => {
          const ans = q.studentAnswer;
          const isText = q.type === "TEXT";

          if (!ans) {
            return (
              <div key={q.id} className="surface-card p-5 text-muted-foreground text-xs italic">
                Otázka {idx + 1} nebyla studentem zodpovězena.
              </div>
            );
          }

          return (
            <div key={q.id} className="surface-card p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-subject/10 text-[10px] font-bold text-subject mt-0.5">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {q.text}
                    </h4>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      Maximální hodnota: {q.points} b.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground shrink-0">
                    Udělené body:
                  </label>
                  <input
                    type="number"
                    value={points[ans.id] ?? 0}
                    onChange={(e) =>
                      setPoints({
                        ...points,
                        [ans.id]: Math.min(q.points, Math.max(0, parseFloat(e.target.value) || 0)),
                      })
                    }
                    min={0}
                    max={q.points}
                    step={0.5}
                    required
                    disabled={!isText} // Auto-graded are locked for edit by default
                    className="w-16 rounded-md border border-input bg-background px-2 py-1 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-ring/40 text-foreground disabled:bg-muted/40 disabled:text-muted-foreground"
                  />
                  <span className="text-xs text-muted-foreground">/ {q.points} b.</span>
                </div>
              </div>

              {/* Student answer detail */}
              <div className="pl-7 space-y-3">
                {isText ? (
                  <p className="text-sm text-foreground bg-muted/20 p-3 rounded-lg border border-border whitespace-pre-wrap font-medium">
                    {ans.text || <span className="italic text-muted-foreground">Bez odpovědi</span>}
                  </p>
                ) : (
                  <div className="grid gap-2 text-xs">
                    {q.options.map((o: any) => {
                      const selected = ans.selectedOptionIds?.includes(o.id) ?? false;
                      const correct = o.isCorrect;
                      let optionStyle = "border-border text-muted-foreground";
                      if (selected && correct)
                        optionStyle =
                          "border-emerald-200 bg-emerald-50/10 text-emerald-800 font-semibold";
                      else if (selected && !correct)
                        optionStyle = "border-red-200 bg-red-50/10 text-red-800";
                      else if (!selected && correct)
                        optionStyle =
                          "border-dashed border-emerald-200 bg-emerald-50/5 text-emerald-700/80";

                      return (
                        <div
                          key={o.id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${optionStyle}`}
                        >
                          <input
                            type={q.type === "MULTIPLE" ? "checkbox" : "radio"}
                            disabled
                            checked={selected}
                            className="text-subject"
                          />
                          <span>{o.text}</span>
                          {correct && (
                            <span className="ml-auto text-[9px] font-bold text-emerald-600">
                              Správná volba
                            </span>
                          )}
                          {selected && !correct && (
                            <span className="ml-auto text-[9px] font-bold text-red-600">
                              Student zvolil chybně
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Question feedback comments */}
                <label className="block text-[11px] font-semibold text-muted-foreground max-w-xl">
                  Poznámka k odpovědi (nepovinné)
                  <input
                    type="text"
                    value={comments[ans.id] ?? ""}
                    onChange={(e) => setComments({ ...comments, [ans.id]: e.target.value })}
                    placeholder="Např. Dobrá argumentace / Chybné výpočty..."
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-muted text-muted-foreground"
        >
          Zavřít
        </button>
        <button
          type="submit"
          disabled={busy}
          className="subject-button rounded-lg px-4 py-2 text-sm font-semibold shadow"
        >
          {busy ? "Ukládám..." : "Uložit kompletní hodnocení"}
        </button>
      </div>
    </form>
  );
}
