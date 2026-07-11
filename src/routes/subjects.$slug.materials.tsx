import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderOpen } from "lucide-react";
import { getSubjectMaterials } from "@/lib/data";
import { FileGrid } from "@/components/subject-page-view";
import type { SubjectMaterialsData } from "@/lib/types";

// One quiet page with every downloadable material of the course, grouped by
// its course page — students grab files here without clicking through pages.
export const Route = createFileRoute("/subjects/$slug/materials")({
  loader: ({ params }) => getSubjectMaterials({ data: params.slug }),
  head: () => ({
    meta: [{ title: "Materiály — Školka" }],
  }),
  component: MaterialsPage,
});

function MaterialsPage() {
  const data = Route.useLoaderData() as SubjectMaterialsData;
  const totalFiles = data.pages.reduce((n, p) => n + p.files.length, 0);

  return (
    <section>
      <div className="mb-6">
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-foreground">
          <FolderOpen className="h-6 w-6 text-subject" /> Materiály
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Všechny soubory kurzu na jednom místě — kliknutím stáhnete.
        </p>
      </div>

      {totalFiles === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          V tomto kurzu zatím nejsou žádné materiály ke stažení.
        </p>
      ) : (
        <div className="space-y-8">
          {data.pages.map((p) => (
            <div key={p.id}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="font-display text-base font-semibold text-foreground">{p.title}</h3>
                <Link
                  to="/subjects/$slug/p/$pageSlug"
                  params={{ slug: data.subjectSlug, pageSlug: p.slug }}
                  className="shrink-0 text-xs font-medium text-subject hover:underline"
                >
                  Otevřít stránku →
                </Link>
              </div>
              <FileGrid files={p.files} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
