import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
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
} from "lucide-react";
import { requireUser } from "@/lib/guards";
import { getTestsList } from "@/lib/test-data";
import { createTest, deleteTest } from "@/lib/test-actions";
import { useUser } from "@/lib/use-user";
import { isStaff } from "@/lib/roles";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";

export const Route = createFileRoute("/subjects/$slug/tests")({
  beforeLoad: ({ context }) => {
    requireUser(context.user);
  },
  loader: ({ params }) => getTestsList({ data: params.slug }),
  component: TestsListPage,
});

function TestsListPage() {
  const { slug } = Route.useParams();
  const { subjectName, tests, subjectId } = Route.useLoaderData();
  const user = useUser();
  const staff = !!user && isStaff(user.role);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Testy a kvízy
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Přehled vědomostních testů pro předmět {subjectName}.
          </p>
        </div>
        {staff && <CreateTestModal subjectId={subjectId} />}
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
    </div>
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
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        Odevzdáno {att.score !== null ? `(${att.score} b.)` : "(Čeká na ohodnocení)"}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm text-sm">
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
        </div>
      )}
    </>
  );
}
