import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FileDown } from "lucide-react";
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

/** "1" → 1, "1-" → 1.5, anything else → null (letters like "A"/"N" don't average). */
function gradeValue(grade: string | null): number | null {
  if (!grade) return null;
  const m = /^([1-5])(-)?$/.exec(grade.trim());
  if (!m) return null;
  return Number(m[1]) + (m[2] ? 0.5 : 0);
}

function formatAvg(values: number[]): string | null {
  if (values.length === 0) return null;
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2).replace(".", ",");
}

function OverviewPage() {
  const data = Route.useLoaderData() as ClassOverviewData;
  const { slug } = Route.useParams();
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const [selectedCell, setSelectedCell] = useState<{
    row: (typeof data.rows)[number];
    a: (typeof data.assignments)[number];
    cell: OverviewCell;
  } | null>(null);

  const groupNames = Array.from(
    new Set(data.rows.map((r) => r.studyGroup).filter((g): g is string => !!g)),
  ).sort((a, b) => a.localeCompare(b));

  const rows =
    groupFilter === "all"
      ? data.rows
      : data.rows.filter((r) =>
          groupFilter === "none" ? !r.studyGroup : r.studyGroup === groupFilter,
        );

  // Class average per assignment column (numeric grades only, Bakaláři-style).
  const columnAvg = data.assignments.map((a) =>
    formatAvg(
      rows
        .map((r) => gradeValue(r.cells[a.id]?.grade ?? null))
        .filter((v): v is number => v !== null),
    ),
  );

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 font-display text-2xl font-semibold text-foreground">
            Přehled třídy
          </h2>
          <p className="text-sm text-muted-foreground">
            Kliknutím na jméno otevřete kartu žáka, kliknutím na buňku hodnocení. Čísla sloupců
            odpovídají úkolům v legendě.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {groupNames.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Skupina:
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/40"
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
          <button
            onClick={() => exportCsv({ ...data, rows })}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-accent"
          >
            <FileDown className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {data.assignments.length === 0 ? (
        <p className="text-muted-foreground">Zatím žádné zadané úkoly.</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">Žádní studenti ve zvolené skupině.</p>
      ) : (
        <>
          {/* Legend: column number → assignment */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {data.assignments.map((a, i) => (
              <Link
                key={a.id}
                to="/subjects/$slug/assignments/$aid"
                params={{ slug, aid: a.id }}
                className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface py-1 pl-1 pr-2.5 text-xs shadow-sm transition-colors hover:border-subject/40 hover:bg-subject-soft/40"
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-subject text-[11px] font-bold text-[color:var(--subject-foreground)]">
                  {i + 1}
                </span>
                <span className="truncate font-medium text-foreground group-hover:text-subject">
                  {a.title}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {TARGET_LABEL[a.targetType]} · {formatDate(a.dueAt)}
                </span>
              </Link>
            ))}
          </div>

          <div className="surface-card overflow-x-auto">
            <table className="w-auto table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="w-44 px-3 py-2.5 text-left sm:w-52">
                    <span className="block text-xs font-bold text-foreground">Student</span>
                    <span className="mt-0.5 block text-[9px] font-normal text-muted-foreground">
                      Skupina · dvojice
                    </span>
                  </th>
                  <th className="w-12 px-1 py-2.5 text-center" title="Průměr známek studenta">
                    <span className="block text-xs font-bold text-foreground">Ø</span>
                  </th>
                  {data.assignments.map((a, i) => (
                    <th key={a.id} className="w-12 px-0.5 py-2 text-center align-bottom">
                      <Link
                        to="/subjects/$slug/assignments/$aid"
                        params={{ slug, aid: a.id }}
                        title={`${a.title} — ${TARGET_LABEL[a.targetType]} · ${formatDate(a.dueAt)}`}
                        className="group inline-flex flex-col items-center gap-1"
                      >
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-subject-soft text-[11px] font-bold text-subject ring-1 ring-subject/30 transition-colors group-hover:bg-subject group-hover:text-[color:var(--subject-foreground)]">
                          {i + 1}
                        </span>
                        <span className="block text-[9px] font-normal leading-none text-muted-foreground">
                          {new Date(a.dueAt).toLocaleDateString("cs-CZ", {
                            day: "numeric",
                            month: "numeric",
                          })}
                        </span>
                      </Link>
                    </th>
                  ))}
                </tr>
                {/* Class averages row, like Bakaláři */}
                <tr className="border-b border-border bg-muted/20 text-[11px] text-muted-foreground">
                  <td className="px-3 py-1.5 font-medium">Ø třídy</td>
                  <td className="px-1 py-1.5 text-center">
                    {formatAvg(
                      rows
                        .flatMap((r) =>
                          data.assignments.map((a) => gradeValue(r.cells[a.id]?.grade ?? null)),
                        )
                        .filter((v): v is number => v !== null),
                    ) ?? "—"}
                  </td>
                  {columnAvg.map((avg, i) => (
                    <td
                      key={data.assignments[i].id}
                      className="px-0.5 py-1.5 text-center font-semibold"
                    >
                      {avg ?? "—"}
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row) => {
                  const myAvg = formatAvg(
                    data.assignments
                      .map((a) => gradeValue(row.cells[a.id]?.grade ?? null))
                      .filter((v): v is number => v !== null),
                  );
                  return (
                    <tr key={row.studentId} className="transition-colors hover:bg-accent/40">
                      <td className="px-3 py-2">
                        <Link
                          to="/subjects/$slug/students/$sid"
                          params={{ slug, sid: row.studentId }}
                          title="Otevřít kartu žáka"
                          className="block truncate text-sm font-semibold text-foreground hover:text-subject hover:underline"
                        >
                          {row.name}
                        </Link>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {[row.studyGroup, row.pair].filter(Boolean).join(" · ") || "bez skupiny"}
                        </span>
                      </td>
                      <td className="px-1 py-2 text-center text-xs font-bold text-foreground">
                        {myAvg ?? <span className="font-normal text-muted-foreground">—</span>}
                      </td>
                      {data.assignments.map((a) => {
                        const cell = row.cells[a.id];
                        const active = cell && cell.status !== "none";
                        return (
                          <td
                            key={a.id}
                            onClick={() => {
                              if (active) setSelectedCell({ row, a, cell });
                            }}
                            className={`px-0.5 py-2 text-center select-none ${
                              active ? "cursor-pointer transition-colors hover:bg-muted/70" : ""
                            }`}
                          >
                            <Cell cell={cell} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
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

/** One compact cell: the grade if graded, otherwise a simple dash. */
function Cell({ cell }: { cell: OverviewCell | undefined }) {
  if (!cell || cell.status === "none") {
    return <span className="text-muted-foreground/30">—</span>;
  }

  const tooltip = [
    cell.status === "submitted"
      ? `Odevzdáno, verzí: ${cell.versions}`
      : cell.status === "overdue"
        ? "Po termínu, neodevzdáno"
        : "Čeká na odevzdání",
    cell.grade ? `Známka: ${cell.grade}` : null,
    cell.locked ? "Odevzdávání uzamčeno" : null,
    cell.extension
      ? `Prodloužený termín do ${new Date(cell.extension).toLocaleDateString("cs-CZ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span className="relative inline-flex flex-col items-center justify-center gap-0.5">
      <span className="inline-flex items-center font-medium" title={tooltip}>
        {cell.grade ? (
          <span className="text-sm font-bold text-foreground">{cell.grade}</span>
        ) : cell.status === "overdue" ? (
          <span className="text-sm font-bold text-red-500" title="Nehodnoceno — po termínu">
            N
          </span>
        ) : (
          <span className="text-muted-foreground/30">—</span>
        )}
      </span>
      {cell.latePenalties.length > 0 && (
        <details onClick={(e) => e.stopPropagation()} className="text-left">
          <summary
            title="Penalizace za time management"
            className="inline-flex h-3.5 min-w-3.5 cursor-pointer list-none items-center justify-center rounded-full bg-red-100 px-1 text-[8px] font-bold text-red-700 ring-1 ring-red-200 select-none"
          >
            +{cell.latePenalties.length}×5
          </summary>
          <div className="absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-red-200 bg-red-50 p-1.5 text-left text-[9px] text-red-800 shadow-md">
            {cell.latePenalties.map((p) => (
              <div key={p.weekIndex}>
                Týden {p.weekIndex}: 5 (váha {p.weight})
              </div>
            ))}
          </div>
        </details>
      )}
    </span>
  );
}
