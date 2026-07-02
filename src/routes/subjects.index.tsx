import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { listSubjects } from "@/lib/data";
import type { SubjectCard } from "@/lib/types";

export const Route = createFileRoute("/subjects/")({
  beforeLoad: ({ context }) => {
    requireUser(context.user);
  },
  loader: () => listSubjects(),
  head: () => ({
    meta: [{ title: "Předměty — Školka" }],
  }),
  component: SubjectsIndex,
});

function SubjectsIndex() {
  const subjects = Route.useLoaderData() as SubjectCard[];

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">Vaše stránky</p>
        <h1 className="text-3xl sm:text-4xl font-semibold">Předměty</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Každý předmět má vlastní vizuální identitu — ale stejné komponenty, navigaci a chování.
        </p>
      </header>

      {subjects.length === 0 ? (
        <p className="text-muted-foreground">Zatím nejste přiřazeni k žádnému předmětu.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {subjects.map((s) => (
            <Link
              key={s.id}
              to="/subjects/$slug"
              params={{ slug: s.slug }}
              data-subject-theme={s.theme}
              className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-8 transition-shadow hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="subject-grid-bg absolute inset-0 opacity-60" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-6">
                  <span className="h-2.5 w-2.5 rounded-full bg-subject" />
                  <span className="subject-chip">
                    {s.className} · {s.schoolYear}
                  </span>
                </div>
                <h2 className="font-display text-2xl font-semibold">{s.name}</h2>
                <p className="mt-2 text-muted-foreground">{s.description}</p>
                <div className="mt-8 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {s.studentCount} studentů · {s.assignmentCount} úkolů
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-subject">
                    Otevřít
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
