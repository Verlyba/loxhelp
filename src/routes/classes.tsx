import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Archive, Plus, RotateCcw } from "lucide-react";
import { requireStaff } from "@/lib/guards";
import { getClasses } from "@/lib/data";
import { createClass, setClassArchived } from "@/lib/actions";
import type { ClassWithSubjects } from "@/lib/types";

export const Route = createFileRoute("/classes")({
  beforeLoad: ({ context }) => {
    requireStaff(context.user);
  },
  loader: () => getClasses(),
  head: () => ({
    meta: [{ title: "Třídy — Školka" }],
  }),
  component: ClassesPage,
});

function ClassesPage() {
  const classes = Route.useLoaderData() as ClassWithSubjects[];
  const router = useRouter();
  const archiveFn = useServerFn(setClassArchived);
  const [showArchived, setShowArchived] = useState(false);

  const list = classes.filter((c) => c.isArchived === showArchived);

  const toggleArchive = async (id: string, isArchived: boolean) => {
    await archiveFn({ data: { id, isArchived } });
    await router.invalidate();
  };

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-muted-foreground">Podle ročníku</p>
          <h1 className="text-3xl sm:text-4xl font-semibold">Třídy</h1>
        </div>
        <div className="inline-flex rounded-md border border-border bg-surface p-1 text-sm">
          <button
            onClick={() => setShowArchived(false)}
            className={`px-3 py-1.5 rounded ${!showArchived ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            Aktivní
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`px-3 py-1.5 rounded inline-flex items-center gap-1 ${showArchived ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            <Archive className="h-3.5 w-3.5" /> Archiv
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {list.length === 0 ? (
            <p className="text-muted-foreground">
              {showArchived ? "Žádné archivované třídy." : "Žádné aktivní třídy."}
            </p>
          ) : (
            list.map((c) => (
              <div key={c.id} className="surface-card overflow-hidden">
                <div className="h-1.5 w-full bg-subject" />
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-semibold">{c.name}</h3>
                    <span className="subject-chip">{c.schoolYear}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{c.studentCount} studentů</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.subjects.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4">
                    {c.isArchived ? (
                      <button
                        onClick={() => toggleArchive(c.id, false)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Obnovit
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleArchive(c.id, true)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                      >
                        <Archive className="h-3.5 w-3.5" /> Archivovat
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <CreateClass />
      </div>
    </main>
  );
}

function CreateClass() {
  const router = useRouter();
  const create = useServerFn(createClass);
  const [name, setName] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { name, schoolYear } });
      setName("");
      setSchoolYear("");
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface-card h-fit p-5 grid gap-3 lg:sticky lg:top-20">
      <h2 className="font-display font-semibold flex items-center gap-2">
        <Plus className="h-4 w-4 text-subject" /> Nová třída
      </h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Název (např. 4.A)"
        required
        className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
      <input
        value={schoolYear}
        onChange={(e) => setSchoolYear(e.target.value)}
        placeholder="Školní rok (např. 2026/2027)"
        required
        className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
      <button
        disabled={busy}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Ukládám…" : "Vytvořit třídu"}
      </button>
    </form>
  );
}
