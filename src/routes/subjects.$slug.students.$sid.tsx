import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, MessageSquareText, Users2 } from "lucide-react";
import { requireStaff } from "@/lib/guards";
import { getStudentCard } from "@/lib/data";
import { formatDateTime, formatDate } from "@/lib/format";
import { TARGET_LABEL, type StudentCardData, type StudentCardRow } from "@/lib/types";

export const Route = createFileRoute("/subjects/$slug/students/$sid")({
  beforeLoad: ({ context }) => {
    requireStaff(context.user);
  },
  loader: ({ params }) => getStudentCard({ data: { slug: params.slug, studentId: params.sid } }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.student.name} — Školka` }] : [],
  }),
  component: StudentCardPage,
});

function StudentCardPage() {
  const data = Route.useLoaderData() as StudentCardData;
  const { slug } = Route.useParams();
  const initials = data.student.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="space-y-6">
      <Link
        to="/subjects/$slug/overview"
        params={{ slug }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Zpět na přehled třídy
      </Link>

      {/* Identity */}
      <header className="flex flex-wrap items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-subject text-lg font-bold text-[color:var(--subject-foreground)]">
          {initials}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold">{data.student.name}</h2>
          <p className="text-sm text-muted-foreground">
            {data.student.email}
            {data.student.className && ` · třída ${data.student.className}`}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5 text-xs">
          {data.studyGroup && (
            <span className="inline-flex items-center gap-1 rounded-full bg-subject-soft px-2.5 py-1 font-medium ring-1 ring-subject/30">
              <Users2 className="h-3.5 w-3.5" /> {data.studyGroup}
            </span>
          )}
          {data.pair && (
            <span
              className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground"
              title={
                data.pair.partnerNames.length
                  ? `S: ${data.pair.partnerNames.join(", ")}`
                  : undefined
              }
            >
              {data.pair.name}
              {data.pair.partnerNames.length > 0 && ` · s ${data.pair.partnerNames.join(", ")}`}
            </span>
          )}
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Odevzdáno" value={`${data.stats.submitted}/${data.stats.total}`} />
        <Stat label="Průměr známek" value={data.stats.avgGrade ?? "—"} />
        <Stat
          label="Včas odevzdané"
          value={data.stats.onTimeRate !== null ? `${data.stats.onTimeRate} %` : "—"}
        />
        <Stat label="Nahraných verzí" value={String(data.stats.totalUploads)} />
      </div>

      {/* Per-assignment report */}
      <div className="surface-card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Úkol</th>
              <th className="px-3 py-3 font-medium">Stav</th>
              <th className="px-3 py-3 font-medium">Odevzdáno</th>
              <th
                className="px-3 py-3 text-center font-medium"
                title="Verze nahrané tímto studentem / celkem za jednotku"
              >
                Verze
              </th>
              <th className="px-3 py-3 text-center font-medium">Známka</th>
              <th className="w-10 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.rows.map((r) => (
              <Row key={r.assignmentId} row={r} slug={slug} />
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  V kurzu zatím nejsou žádné zadané úkoly.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent uploads */}
      {data.recentUploads.length > 0 && (
        <div className="surface-card p-5">
          <h3 className="mb-3 font-display text-sm font-semibold">Poslední nahrané soubory</h3>
          <ul className="space-y-1.5 text-sm">
            {data.recentUploads.map((u, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span className="mono min-w-0 truncate">{u.fileName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {u.assignmentTitle} · {formatDateTime(u.uploadedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-4 text-center">
      <p className="font-display text-2xl font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ row, slug }: { row: StudentCardRow; slug: string }) {
  const statusChip =
    row.status === "submitted" ? (
      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
        Odevzdáno{row.onTime === false ? " (pozdě)" : ""}
      </span>
    ) : row.status === "overdue" ? (
      <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
        Po termínu
      </span>
    ) : row.status === "pending" ? (
      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
        Čeká
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">bez skupiny</span>
    );

  return (
    <tr className="transition-colors hover:bg-accent/40">
      <td className="px-4 py-2.5">
        <Link
          to="/subjects/$slug/assignments/$aid"
          params={{ slug, aid: row.assignmentId }}
          className="font-medium hover:underline"
        >
          {row.title}
        </Link>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {TARGET_LABEL[row.targetType]} · termín {formatDate(row.dueAt)}
        </span>
      </td>
      <td className="px-3 py-2.5">{statusChip}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        {row.submittedAt ? formatDateTime(row.submittedAt) : "—"}
      </td>
      <td className="px-3 py-2.5 text-center text-xs">
        <span className="font-semibold">{row.myUploads}</span>
        <span className="text-muted-foreground"> / {row.versions}</span>
      </td>
      <td className="px-3 py-2.5 text-center">
        {row.grade ? (
          <span className="inline-flex rounded-full bg-subject-soft px-2.5 py-0.5 text-sm font-bold ring-1 ring-subject/30">
            {row.grade}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
        {row.feedback && (
          <span title={row.feedback} className="inline-block cursor-help text-subject">
            <MessageSquareText className="h-4 w-4" />
          </span>
        )}
      </td>
    </tr>
  );
}
