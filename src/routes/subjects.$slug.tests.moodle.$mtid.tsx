import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Clock, FileSpreadsheet, Users2 } from "lucide-react";
import { requireStaff } from "@/lib/guards";
import { getMoodleTestDetail } from "@/lib/data";
import { updateMoodleTestResult } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import type { MoodleTestDetail, MoodleTestResultRow } from "@/lib/types";

export const Route = createFileRoute("/subjects/$slug/tests/moodle/$mtid")({
  beforeLoad: ({ context }) => {
    requireStaff(context.user);
  },
  loader: ({ params }) => getMoodleTestDetail({ data: params.mtid }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.title} — Shtroodle` }] : [],
  }),
  component: MoodleTestDetailPage,
});

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

function MoodleTestDetailPage() {
  const data = Route.useLoaderData() as MoodleTestDetail;
  const { slug } = Route.useParams();

  const unmatched = data.results.filter((r) => !r.userId).length;

  return (
    <section>
      <Link
        to="/subjects/$slug/tests"
        params={{ slug }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Zpět na testy
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-foreground">
            <FileSpreadsheet className="h-6 w-6 text-subject" /> {data.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Import z Moodle · {data.results.length} pokusů · max {data.maxPoints} b.
          </p>
        </div>
        {unmatched > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
            <Users2 className="h-3.5 w-3.5" /> {unmatched} nepřiřazeno
          </span>
        )}
      </header>

      <div className="surface-card mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-3 py-3 font-medium">Datum pokusu</th>
              <th className="px-3 py-3 font-medium">Doba trvání</th>
              <th className="px-3 py-3 text-center font-medium">Body</th>
              <th className="px-3 py-3 text-center font-medium">%</th>
              <th className="px-3 py-3 text-center font-medium">Známka</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.results.map((r) => (
              <ResultRow
                key={r.id}
                row={r}
                maxPoints={data.maxPoints}
                students={data.enrolledStudents}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Klikněte na jméno u nepřiřazeného řádku a vyberte studenta. Body i známku lze opravit — po
        úpravě bodů se známka dopočítá znovu podle aktuálních hranic kurzu, pokud ji neupravíte
        ručně.
      </p>
    </section>
  );
}

function ResultRow({
  row,
  maxPoints,
  students,
}: {
  row: MoodleTestResultRow;
  maxPoints: number;
  students: { id: string; name: string }[];
}) {
  const router = useRouter();
  const update = useServerFn(updateMoodleTestResult);
  const [busy, setBusy] = useState(false);

  const saveUser = async (userId: string) => {
    setBusy(true);
    try {
      await update({ data: { id: row.id, userId: userId || null } });
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uložení selhalo.");
    } finally {
      setBusy(false);
    }
  };

  const saveScore = async (raw: string) => {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return;
    setBusy(true);
    try {
      await update({ data: { id: row.id, rawScore: Math.max(0, Math.min(maxPoints, n)) } });
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uložení selhalo.");
    } finally {
      setBusy(false);
    }
  };

  const saveGrade = async (grade: string) => {
    setBusy(true);
    try {
      await update({ data: { id: row.id, grade: grade as "1" | "2" | "3" | "4" | "5" } });
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uložení selhalo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="hover:bg-accent/40 transition-colors">
      <td className="px-4 py-2.5">
        {row.userId ? (
          <Link
            to="/students/$sid"
            params={{ sid: row.userId }}
            className="font-medium text-subject hover:underline"
          >
            {row.matchedName}
          </Link>
        ) : (
          <select
            value=""
            disabled={busy}
            onChange={(e) => saveUser(e.target.value)}
            className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 outline-none focus:ring-2 focus:ring-ring/40"
          >
            <option value="" disabled>
              {row.matchedName} — vybrat studenta
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        {row.attemptAt ? formatDateTime(row.attemptAt) : "—"}
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" /> {formatDuration(row.durationSeconds)}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center">
        <input
          defaultValue={row.rawScore.toString().replace(".", ",")}
          onBlur={(e) => e.target.value !== "" && saveScore(e.target.value)}
          disabled={busy}
          className="w-16 rounded-md border border-input bg-background px-2 py-1 text-center text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
        <span className="ml-1 text-xs text-muted-foreground">/ {maxPoints}</span>
      </td>
      <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
        {row.percentage.toFixed(0)} %
      </td>
      <td className="px-3 py-2.5 text-center">
        <select
          value={row.grade}
          disabled={busy}
          onChange={(e) => saveGrade(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm font-bold text-center outline-none focus:ring-2 focus:ring-ring/40"
        >
          {["1", "2", "3", "4", "5"].map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
