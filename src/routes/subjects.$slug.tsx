import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  FileText,
  ListTodo,
  Plus,
  Trash2,
  Users2,
  BarChart3,
  Settings,
  X,
  Megaphone,
  FileQuestion,
  FolderOpen,
  BookMarked,
  Map,
} from "lucide-react";
import { requireUser } from "@/lib/guards";
import { getSubject } from "@/lib/data";
import {
  createSubjectPage,
  deleteSubjectPage,
  updateSubject,
  deleteSubject,
  movePage,
  setActiveTopic,
} from "@/lib/actions";
import { useUser } from "@/lib/use-user";
import { isStaff, type SubjectTheme } from "@/lib/roles";
import { ThemePicker } from "@/components/theme-picker";
import { StudentTopPanels, StaffTopPanels } from "@/components/subject-top-panels";
import type { PageTemplate, SubjectDetail, SubjectPageNav } from "@/lib/types";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";
import { CoverImageField } from "@/components/cover-picker";
import { ModalBackdrop } from "@/components/modal-backdrop";

export const Route = createFileRoute("/subjects/$slug")({
  beforeLoad: ({ context }) => {
    requireUser(context.user);
  },
  loader: ({ params }) => getSubject({ data: params.slug }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.name} — Shtroodle` }] : [],
  }),
  component: SubjectLayout,
});

const PAGE_ICON: Record<PageTemplate, typeof FileText> = {
  content: FileText,
  assignments: ListTodo,
};

function SubjectLayout() {
  const subject = Route.useLoaderData() as SubjectDetail;
  const user = useUser();
  const staff = !!user && isStaff(user.role);
  const [modalOpen, setModalOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The class overview grid needs every pixel — drop the right rail there.
  const wideContent = pathname.endsWith("/overview");

  return (
    <div
      data-subject-theme={subject.theme}
      className="min-h-[calc(100vh-3.5rem)] bg-background text-foreground"
    >
      {/* Compact hero with optional image banner */}
      <div className="subject-hero border-b border-border relative overflow-hidden bg-muted">
        {subject.imageUrl ? (
          <div
            className="absolute right-0 top-0 h-full w-[26rem] bg-cover bg-center opacity-40 sm:w-[34rem] md:w-[48rem]"
            style={{
              backgroundImage: `url(${subject.imageUrl})`,
              maskImage:
                "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.02) 8%, rgba(0,0,0,0.08) 16%, rgba(0,0,0,0.18) 24%, rgba(0,0,0,0.32) 32%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.68) 48%, rgba(0,0,0,0.82) 56%, rgba(0,0,0,0.92) 64%, rgba(0,0,0,0.98) 72%, black 85%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.02) 8%, rgba(0,0,0,0.08) 16%, rgba(0,0,0,0.18) 24%, rgba(0,0,0,0.32) 32%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.68) 48%, rgba(0,0,0,0.82) 56%, rgba(0,0,0,0.92) 64%, rgba(0,0,0,0.98) 72%, black 85%)",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-subject/10 to-subject/5" />
        )}
        <div className="subject-grid-bg absolute inset-0 opacity-40 pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-7 relative z-10">
          <Link
            to="/subjects"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Všechny předměty
          </Link>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="font-display text-2xl sm:text-4xl font-semibold tracking-tight">
                {subject.name}
              </h1>
              <span className="subject-chip">
                {subject.className} · {subject.schoolYear}
              </span>
            </div>

            {staff && (
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold bg-surface hover:bg-muted text-foreground transition-all cursor-pointer shadow-sm"
              >
                <Settings className="h-3.5 w-3.5" /> Nastavení kurzu
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        className={`mx-auto max-w-[90rem] px-4 sm:px-6 py-6 lg:py-8 pb-32 lg:pb-40 lg:grid lg:grid-cols-[220px_1fr] lg:gap-7 ${
          wideContent ? "" : "xl:grid-cols-[220px_1fr_330px]"
        }`}
      >
        <PageSidebar subject={subject} />
        <div className="min-w-0 mt-6 lg:mt-0">
          {/* On smaller screens the panels sit above the content */}
          {!wideContent && (subject.studentPanel || subject.staffPanel) && (
            <div className="mb-6 xl:hidden">
              {subject.studentPanel && (
                <StudentTopPanels panel={subject.studentPanel} subjectSlug={subject.slug} />
              )}
              {subject.staffPanel && (
                <StaffTopPanels panel={subject.staffPanel} subjectSlug={subject.slug} />
              )}
            </div>
          )}
          <Outlet />
        </div>

        {/* Right rail — static course panels (xl+) */}
        {!wideContent && (subject.studentPanel || subject.staffPanel) && (
          <aside className="hidden xl:block">
            <div className="sticky top-[4.5rem] max-h-[calc(100vh-5.5rem)] overflow-y-auto pr-1">
              {subject.studentPanel && (
                <StudentTopPanels panel={subject.studentPanel} subjectSlug={subject.slug} />
              )}
              {subject.staffPanel && (
                <StaffTopPanels panel={subject.staffPanel} subjectSlug={subject.slug} />
              )}
            </div>
          </aside>
        )}
      </div>

      {modalOpen && (
        <EditSubjectModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          subject={subject}
        />
      )}
    </div>
  );
}

function EditSubjectModal({
  isOpen,
  onClose,
  subject,
}: {
  isOpen: boolean;
  onClose: () => void;
  subject: SubjectDetail;
}) {
  const router = useRouter();
  const update = useServerFn(updateSubject);
  const del = useServerFn(deleteSubject);
  const { confirm } = useDialog();

  const [name, setName] = useState(subject.name);
  const [description, setDescription] = useState(subject.description || "");
  const [imageUrl, setImageUrl] = useState(subject.imageUrl || "");
  const [themeStyle, setThemeStyle] = useState<SubjectTheme>(subject.theme);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await update({
        data: {
          id: subject.id,
          name,
          description,
          imageUrl: imageUrl || null,
          themeStyle,
        },
      });
      await router.invalidate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uložení selhalo.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Smazat předmět ${subject.name}?`,
      message:
        "Smažou se všechny úkoly, odevzdání, materiály, diskusní fóra, testy a pokusy studentů. Akce je nevratná!",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await del({ data: subject.id });
      toast.success(`Předmět ${subject.name} byl smazán.`);
      router.navigate({ to: "/subjects" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při mazání.");
      setBusy(false);
    }
  };

  return (
    <ModalBackdrop
      onClose={onClose}
      ariaLabel="Nastavení kurzu (předmětu)"
      className="flex items-center justify-center p-4 text-sm"
    >
      <div className="bg-surface rounded-2xl shadow-elevated border border-border max-w-lg w-full overflow-hidden">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <h3 className="font-display font-bold text-lg text-foreground">
            Nastavení kurzu (předmětu)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <label className="block text-xs font-semibold text-muted-foreground">
            Název předmětu
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
            />
          </label>

          <label className="block text-xs font-semibold text-muted-foreground">
            Anotace / Popis
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40 resize-none"
            />
          </label>

          <CoverImageField value={imageUrl} onChange={setImageUrl} />

          <label className="block text-xs font-semibold text-muted-foreground">
            Barevný motiv kurzu
            <ThemePicker value={themeStyle} onChange={setThemeStyle} />
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-between items-center pt-4 border-t border-border mt-6">
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="px-4 py-2 rounded-lg border border-red-200 text-sm font-medium hover:bg-red-100 text-red-700 bg-red-50 disabled:opacity-60 cursor-pointer"
            >
              {busy ? "Mažu..." : "Smazat předmět"}
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground bg-surface cursor-pointer"
              >
                Storno
              </button>
              <button
                type="submit"
                disabled={busy}
                className="subject-button px-4 py-2 rounded-lg text-sm font-semibold shadow cursor-pointer"
              >
                {busy ? "Ukládám..." : "Uložit změny"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </ModalBackdrop>
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
        {/* Announcements — always first, like Moodle's news forum */}
        <Link
          to="/subjects/$slug/news"
          params={{ slug: subject.slug }}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
            pathname.endsWith("/news")
              ? "nav-active font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
        >
          <Megaphone className="h-4 w-4 shrink-0" />
          <span className="truncate">Oznámení</span>
          {subject.unreadAnnouncementCount > 0 ? (
            <span className="ml-auto rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
              {subject.unreadAnnouncementCount}
            </span>
          ) : (
            subject.announcementCount > 0 && (
              <span className="ml-auto rounded-full bg-subject-soft px-1.5 text-[11px] font-semibold ring-1 ring-subject/30">
                {subject.announcementCount}
              </span>
            )
          )}
        </Link>
        <Link
          to="/subjects/$slug/tests"
          params={{ slug: subject.slug }}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
            pathname.includes("/tests")
              ? "nav-active font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
        >
          <FileQuestion className="h-4 w-4 shrink-0" />
          <span className="truncate">Testy</span>
        </Link>
        <Link
          to="/subjects/$slug/materials"
          params={{ slug: subject.slug }}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
            pathname.endsWith("/materials")
              ? "nav-active font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="truncate">Materiály</span>
        </Link>
        <Link
          to="/subjects/$slug/roadmap"
          params={{ slug: subject.slug }}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
            pathname.endsWith("/roadmap")
              ? "nav-active font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
        >
          <Map className="h-4 w-4 shrink-0" />
          <span className="truncate">Roadmapa</span>
        </Link>

        {/* Pinned pages: same rows as below, but pulled up next to the fixed nav items. */}
        {subject.pages.some((p) => p.isPinned) && (
          <span className="mt-1 hidden px-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70 lg:block">
            Připnuto
          </span>
        )}
        {subject.pages
          .filter((p) => p.isPinned)
          .map((p) => {
            const index = subject.pages.findIndex((x) => x.id === p.id);
            return (
              <PageRow
                key={p.id}
                page={p}
                index={index}
                subject={subject}
                pathname={pathname}
                staff={staff}
                isFirst={index === 0}
                isLast={index === subject.pages.length - 1}
              />
            );
          })}

        <div className="my-1 hidden border-t border-border lg:block" />
        <span className="hidden px-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70 lg:block">
          Stránky
        </span>

        {subject.pages
          .filter((p) => !p.isPinned)
          .map((p) => {
            const index = subject.pages.findIndex((x) => x.id === p.id);
            return (
              <PageRow
                key={p.id}
                page={p}
                index={index}
                subject={subject}
                pathname={pathname}
                staff={staff}
                isFirst={index === 0}
                isLast={index === subject.pages.length - 1}
              />
            );
          })}
        {staff && <AddPage subjectId={subject.id} subjectSlug={subject.slug} />}

        {staff && (
          <>
            <div className="my-1 hidden border-t border-border lg:block" />
            <Link
              to="/subjects/$slug/groups"
              params={{ slug: subject.slug }}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                pathname.endsWith("/groups")
                  ? "nav-active font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              }`}
            >
              <Users2 className="h-4 w-4 shrink-0" /> Skupiny a dvojice
            </Link>
            <Link
              to="/subjects/$slug/overview"
              params={{ slug: subject.slug }}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                pathname.endsWith("/overview")
                  ? "nav-active font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              }`}
            >
              <BarChart3 className="h-4 w-4 shrink-0" /> Přehled třídy
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}

/** One row in the sidebar page list — used for both the pinned group and the regular list below. */
function PageRow({
  page: p,
  index,
  subject,
  pathname,
  staff,
  isFirst,
  isLast,
}: {
  page: SubjectPageNav;
  index: number;
  subject: SubjectDetail;
  pathname: string;
  staff: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const href = `/subjects/${subject.slug}/p/${p.slug}`;
  const active = pathname === href || (index === 0 && pathname === `/subjects/${subject.slug}`);
  const isTopic = p.id === subject.activePageId;
  const Icon = PAGE_ICON[p.template];
  return (
    <div className="group/item relative flex shrink-0 items-center">
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
        {isTopic && (
          <span
            title="Právě probíraná látka"
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-subject-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-subject ring-1 ring-subject/30 lg:group-hover/item:hidden"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-subject" />
            <span className="hidden lg:inline">Probíráme</span>
          </span>
        )}
      </Link>
      {staff && (
        <PageRowActions
          page={p}
          subjectId={subject.id}
          subjectSlug={subject.slug}
          isFirst={isFirst}
          isLast={isLast}
          isTopic={isTopic}
        />
      )}
    </div>
  );
}

/** Hover actions on a sidebar page row: mark as taught topic, move up/down + delete (staff). */
function PageRowActions({
  page,
  subjectId,
  subjectSlug,
  isFirst,
  isLast,
  isTopic,
}: {
  page: SubjectPageNav;
  subjectId: string;
  subjectSlug: string;
  isFirst: boolean;
  isLast: boolean;
  isTopic: boolean;
}) {
  const router = useRouter();
  const del = useServerFn(deleteSubjectPage);
  const move = useServerFn(movePage);
  const setTopic = useServerFn(setActiveTopic);
  const [busy, setBusy] = useState(false);
  const { confirm } = useDialog();

  const handleMove = async (direction: "up" | "down") => {
    setBusy(true);
    try {
      await move({ data: { id: page.id, direction } });
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const handleTopic = async () => {
    setBusy(true);
    try {
      await setTopic({ data: { subjectId, pageId: isTopic ? null : page.id } });
      toast.success(
        isTopic
          ? "Označení probírané látky zrušeno."
          : `„${page.title}“ je teď probíraná látka — studenti ji uvidí na hlavním panelu.`,
      );
      await router.invalidate();
    } catch {
      toast.error("Označení se nepodařilo změnit.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="absolute right-1 hidden items-center gap-0 bg-inherit lg:group-hover/item:flex">
      <button
        type="button"
        aria-label={
          isTopic
            ? "Zrušit označení probírané látky"
            : `Označit ${page.title} jako probíranou látku`
        }
        title={isTopic ? "Zrušit „Probíráme“" : "Označit jako probíranou látku"}
        disabled={busy}
        onClick={handleTopic}
        className={`rounded p-0.5 disabled:opacity-50 ${
          isTopic ? "text-subject" : "text-muted-foreground hover:text-subject"
        }`}
      >
        <BookMarked className="h-3.5 w-3.5" />
      </button>
      {!isFirst && (
        <button
          type="button"
          aria-label={`Posunout ${page.title} nahoru`}
          disabled={busy}
          onClick={() => handleMove("up")}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      )}
      {!isLast && (
        <button
          type="button"
          aria-label={`Posunout ${page.title} dolů`}
          disabled={busy}
          onClick={() => handleMove("down")}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        aria-label={`Smazat stránku ${page.title}`}
        disabled={busy}
        onClick={async () => {
          const ok = await confirm({
            title: `Smazat stránku „${page.title}“?`,
            message: "Stránka a veškerý její obsah budou trvale smazány.",
            danger: true,
          });
          if (!ok) return;
          setBusy(true);
          try {
            await del({ data: page.id });
            toast.success(`Stránka „${page.title}“ byla smazána.`);
            router.navigate({ to: "/subjects/$slug", params: { slug: subjectSlug } });
            await router.invalidate();
          } catch (err) {
            toast.error("Stránku se nepodařilo smazat.");
          } finally {
            setBusy(false);
          }
        }}
        className="rounded p-0.5 text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </span>
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
