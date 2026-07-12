import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderOpen, Search, X } from "lucide-react";
import { getSubjectMaterials } from "@/lib/data";
import { FileGrid } from "@/components/subject-page-view";
import type { SubjectMaterialsData } from "@/lib/types";

// One quiet page with every downloadable material of the course, grouped by
// its course page — students grab files here without clicking through pages.
export const Route = createFileRoute("/subjects/$slug/materials")({
  loader: ({ params }) => getSubjectMaterials({ data: params.slug }),
  head: () => ({
    meta: [{ title: "Materiály — Shtroodle" }],
  }),
  component: MaterialsPage,
});

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function MaterialsPage() {
  const data = Route.useLoaderData() as SubjectMaterialsData;
  const [query, setQuery] = useState("");
  const totalFiles = data.pages.reduce((n, p) => n + p.files.length, 0);

  const q = normalize(query.trim());
  const filteredPages = q
    ? data.pages
        .map((p) => ({
          ...p,
          files: p.files.filter((f) =>
            [f.label, f.fileName, f.description, f.category].some((v) => normalize(v).includes(q)),
          ),
        }))
        .filter((p) => p.files.length > 0)
    : data.pages;
  const matchCount = filteredPages.reduce((n, p) => n + p.files.length, 0);

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-foreground">
            <FolderOpen className="h-6 w-6 text-subject" /> Materiály
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Všechny soubory kurzu na jednom místě — kliknutím stáhnete.
          </p>
        </div>

        {totalFiles > 0 && (
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledat materiál…"
              className="w-full rounded-md border border-border bg-background/60 py-1.5 pl-8 pr-7 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
            {query && (
              <button
                type="button"
                aria-label="Vymazat hledání"
                onClick={() => setQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {totalFiles === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          V tomto kurzu zatím nejsou žádné materiály ke stažení.
        </p>
      ) : matchCount === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nic neodpovídá hledání „{query}“.
        </p>
      ) : (
        <div className="space-y-8">
          {filteredPages.map((p) => (
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
