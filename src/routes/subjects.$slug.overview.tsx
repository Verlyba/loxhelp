import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Clock, FileDown } from "lucide-react";
import { requireStaff } from "@/lib/guards";
import { getClassOverview } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { TARGET_LABEL, type ClassOverviewData, type OverviewCell } from "@/lib/types";
import { GradingModal } from "@/components/grading-modal";

/** Builds a spreadsheet-friendly CSV (UTF-8 BOM for Excel) and downloads it. */
function exportCsv(data: ClassOverviewData) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = [
    "Student",
    "Skupina",
    "Dvojice",
    ...data.assignments.flatMap((a) => [`${a.title} — stav`, `${a.title} — známka`]),
  ];
  const lines = data.rows.map((row) => {
    const cells = data.assignments.flatMap((a) => {
      const c = row.cells[a.id];
      const status =
        !c || c.status === "none"
          ? ""
          : c.status === "submitted"
            ? "odevzdáno"
            : c.status === "overdue"
              ? "po termínu"
              : "čeká";
      return [status, c?.grade ?? ""];
    });
    return [row.name, row.studyGroup ?? "", row.pair ?? "", ...cells].map(esc).join(";");
  });
  const csv = "﻿" + [header.map(esc).join(";"), ...lines].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `znamky_${data.subjectName.replace(/\s+/g, "_")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const Route = createFileRoute("/subjects/$slug/overview")({
  beforeLoad: ({ context }) => {
    requireStaff(context.user);
  },
  loader: ({ params }) => getClassOverview({ data: params.slug }),
  head: () => ({
    meta: [{ title: "Přehled třídy — Školka" }],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const data = Route.useLoaderData() as ClassOverviewData;
  const { slug } = Route.useParams();

  const [selectedCell, setSelectedCell] = useState<{
    row: (typeof data.rows)[number];
    a: (typeof data.assignments)[number];
    cell: OverviewCell;
  } | null>(null);

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 font-display text-2xl font-semibold text-foreground">
            Přehled třídy
          </h2>
          <p className="text-sm text-muted-foreground">
            Kliknutím na jméno otevřete kartu žáka, kliknutím na buňku hodnocení.
          </p>
        </div>
        <button
          onClick={() => exportCsv(data)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-accent"
        >
          <FileDown className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {data.assignments.length === 0 ? (
        <p className="text-muted-foreground">Zatím žádné zadané úkoly.</p>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm border-collapse">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="sticky left-0 bg-surface px-4 py-3 border-b border-border font-semibold text-left">
                  <span className="block text-foreground font-bold tracking-normal normal-case text-xs">Student</span>
                  <span className="block text-[9px] text-muted-foreground font-normal normal-case mt-0.5">Jméno a karta</span>
                </th>
                <th className="px-3 py-3 border-b border-border font-semibold text-left">
                  <span className="block text-foreground font-bold tracking-normal normal-case text-xs">Skupina</span>
                  <span className="block text-[9px] text-muted-foreground font-normal normal-case mt-0.5">Tým / Dvojice</span>
                </th>
                {data.assignments.map((a) => (
                  <th key={a.id} className="px-3 py-3 border-b border-border font-semibold text-left min-w-32">
                    <Link
                      to="/subjects/$slug/assignments/$aid"
                      params={{ slug, aid: a.id }}
                      className="block max-w-36 hover:text-subject group"
                    >
                      <span className="block truncate text-foreground font-bold tracking-normal normal-case text-xs group-hover:text-subject transition-colors">{a.title}</span>
                      <span className="block text-[9px] text-muted-foreground font-normal normal-case mt-0.5">
                        {TARGET_LABEL[a.targetType]} · {formatDate(a.dueAt)}
                      </span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.rows.map((row) => (
                <tr key={row.studentId} className="hover:bg-accent/40 transition-colors">
                  <td className="sticky left-0 bg-surface px-4 py-3 font-semibold text-foreground border-b border-border/40">
                    <Link
                      to="/subjects/$slug/students/$sid"
                      params={{ slug, sid: row.studentId }}
                      title="Otevřít kartu žáka"
                      className="hover:text-subject hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground border-b border-border/40">
                    {row.studyGroup ?? "—"}
                    {row.pair && <span className="block font-medium mt-0.5">{row.pair}</span>}
                  </td>
                  {data.assignments.map((a) => {
                    const cell = row.cells[a.id];
                    const active = cell && cell.status !== "none";
                    return (
                      <td
                        key={a.id}
                        onClick={() => {
                          if (active) {
                            setSelectedCell({ row, a, cell });
                          }
                        }}
                        className={`px-3 py-3 select-none border-b border-border/40 ${
                          active
                            ? "cursor-pointer hover:bg-muted/70 transition-colors focus-within:ring-2 focus-within:ring-subject/20"
                            : ""
                        }`}
                      >
                        <Cell cell={cell} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedCell && (
        <GradingModal
          isOpen={!!selectedCell}
          onClose={() => setSelectedCell(null)}
          assignmentId={selectedCell.a.id}
          assignmentTitle={selectedCell.a.title}
          dueDate={selectedCell.a.dueAt}
          targetType={TARGET_LABEL[selectedCell.a.targetType]}
          unit={{
            key: selectedCell.cell.locked ? "locked" : "unit",
            name:
              selectedCell.a.targetType === "INDIVIDUAL"
                ? selectedCell.row.name
                : selectedCell.row.pair || selectedCell.row.studyGroup || selectedCell.row.name,
            members: selectedCell.cell.members,
            versionsList: selectedCell.cell.versionsList,
            grade: selectedCell.cell.grade,
            feedback: selectedCell.cell.feedback,
            locked: selectedCell.cell.locked,
            extension: selectedCell.cell.extension,
          }}
        />
      )}
    </section>
  );
}

function Cell({ cell }: { cell: OverviewCell | undefined }) {
  if (!cell || cell.status === "none") {
    return <span className="text-xs text-muted-foreground">bez skupiny</span>;
  }
  const color =
    cell.status === "submitted"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : cell.status === "overdue"
        ? "bg-red-50 text-red-700 ring-red-200"
        : "bg-amber-50 text-amber-700 ring-amber-200";
  const label = cell.status === "submitted" ? "✓" : cell.status === "overdue" ? "!" : "…";

  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-1 ${color}`}
        title={
          cell.status === "submitted"
            ? `Odevzdáno, verzí: ${cell.versions}`
            : cell.status === "overdue"
              ? "Po termínu, neodevzdáno"
              : "Čeká na odevzdání"
        }
      >
        {label}
      </span>
      {cell.versions > 0 && (
        <span className="text-[11px] text-muted-foreground" title="Verze nahrané tímto studentem">
          {cell.myUploads}×
        </span>
      )}
      {cell.grade && (
        <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-subject-soft text-[10px] font-extrabold text-subject ring-1 ring-subject/20">
          {cell.grade}
        </span>
      )}
      {cell.locked && (
        <span className="text-slate-400" title="Odevzdávání uzamčeno">
          <Lock className="h-3 w-3" />
        </span>
      )}
      {cell.extension && (
        <span
          className="text-amber-500"
          title={`Prodloužený termín do ${new Date(cell.extension).toLocaleDateString()}`}
        >
          <Clock className="h-3 w-3" />
        </span>
      )}
    </span>
  );
}
