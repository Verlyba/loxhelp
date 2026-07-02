import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, FileText, ListTodo, Plus, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { getSubject } from "@/lib/data";
import { createSubjectPage, deleteSubjectPage } from "@/lib/actions";
import { useUser } from "@/lib/use-user";
import { isStaff } from "@/lib/roles";
import type { PageTemplate, SubjectDetail, SubjectPageNav } from "@/lib/types";

export const Route = createFileRoute("/subjects/$slug")({
  beforeLoad: ({ context }) => {
    requireUser(context.user);
  },
  loader: ({ params }) => getSubject({ data: params.slug }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.name} — Školka` }] : [],
  }),
  component: SubjectLayout,
});

const PAGE_ICON: Record<PageTemplate, typeof FileText> = {
  content: FileText,
  assignments: ListTodo,
};

function SubjectLayout() {
  const subject = Route.useLoaderData() as SubjectDetail;

  return (
    <div
      data-subject-theme={subject.theme}
      className="min-h-[calc(100vh-3.5rem)] bg-background text-foreground"
    >
      {/* Compact hero */}
      <div className="subject-hero border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-7">
          <Link
            to="/subjects"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Všechny předměty
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="font-display text-2xl sm:text-4xl font-semibold tracking-tight">
              {subject.name}
            </h1>
            <span className="subject-chip">
              {subject.className} · {subject.schoolYear}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 lg:py-8 lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
        <PageSidebar subject={subject} />
        <div className="min-w-0 mt-6 lg:mt-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

/** Left panel: switches subject pages. Horizontal pill bar below lg. */
function PageSidebar({ subject }: { subject: SubjectDetail }) {
  const user = useUser();
  const staff = !!user && isStaff(user.role);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="lg:sticky lg:top-[4.5rem] lg:h-fit">
      <nav className="glass-panel flex gap-1 overflow-x-auto p-1.5 lg:flex-col lg:overflow-visible lg:p-2">
        {subject.pages.map((p, i) => {
          const href = `/subjects/${subject.slug}/p/${p.slug}`;
          const active = pathname === href || (i === 0 && pathname === `/subjects/${subject.slug}`);
          const Icon = PAGE_ICON[p.template];
          return (
            <div key={p.id} className="group/item relative flex shrink-0 items-center">
              <Link
                to="/subjects/$slug/p/$pageSlug"
                params={{ slug: subject.slug, pageSlug: p.slug }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                  active
                    ? "nav-active font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{p.title}</span>
              </Link>
              {staff && <DeletePage page={p} subjectSlug={subject.slug} />}
            </div>
          );
        })}
        {staff && <AddPage subjectId={subject.id} subjectSlug={subject.slug} />}
      </nav>
    </aside>
  );
}

function DeletePage({ page, subjectSlug }: { page: SubjectPageNav; subjectSlug: string }) {
  const router = useRouter();
  const del = useServerFn(deleteSubjectPage);
  return (
    <button
      type="button"
      aria-label={`Smazat stránku ${page.title}`}
      onClick={async () => {
        if (!confirm(`Smazat stránku „${page.title}"?`)) return;
        await del({ data: page.id });
        router.navigate({ to: "/subjects/$slug", params: { slug: subjectSlug } });
        await router.invalidate();
      }}
      className="absolute right-1.5 hidden rounded p-1 text-muted-foreground hover:text-destructive lg:group-hover/item:block"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function AddPage({ subjectId, subjectSlug }: { subjectId: string; subjectSlug: string }) {
  const router = useRouter();
  const create = useServerFn(createSubjectPage);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<PageTemplate>("content");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await create({ data: { subjectId, title, template } });
      setTitle("");
      setOpen(false);
      await router.invalidate();
      router.navigate({
        to: "/subjects/$slug/p/$pageSlug",
        params: { slug: subjectSlug, pageSlug: res.slug },
      });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60"
      >
        <Plus className="h-4 w-4" /> Nová stránka
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="grid shrink-0 gap-2 rounded-lg border border-border p-2.5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Název stránky"
        autoFocus
        required
        className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
      <select
        value={template}
        onChange={(e) => setTemplate(e.target.value as PageTemplate)}
        className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none"
      >
        <option value="content">Prostá stránka</option>
        <option value="assignments">Šablona: Úkoly</option>
      </select>
      <div className="flex gap-1.5">
        <button
          disabled={busy}
          className="subject-button flex-1 !px-2 !py-1.5 text-xs disabled:opacity-60"
        >
          {busy ? "…" : "Vytvořit"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-2 py-1.5 text-xs"
        >
          Zrušit
        </button>
      </div>
    </form>
  );
}
