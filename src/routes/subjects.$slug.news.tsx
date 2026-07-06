import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { getAnnouncements } from "@/lib/data";
import { createAnnouncement, deleteAnnouncement } from "@/lib/actions";
import { getRouteApi } from "@tanstack/react-router";
import { useUser } from "@/lib/use-user";
import { isStaff } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";
import type { AnnouncementItem, SubjectDetail } from "@/lib/types";
import { toast } from "sonner";
import { useDialog } from "@/components/dialog-provider";

const subjectRoute = getRouteApi("/subjects/$slug");

export const Route = createFileRoute("/subjects/$slug/news")({
  beforeLoad: ({ context }) => {
    requireUser(context.user);
  },
  loader: ({ params }) => getAnnouncements({ data: params.slug }),
  head: () => ({
    meta: [{ title: "Oznámení — Školka" }],
  }),
  component: NewsPage,
});

function NewsPage() {
  const items = Route.useLoaderData() as AnnouncementItem[];
  const user = useUser();
  const staff = !!user && isStaff(user.role);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="mb-1 flex items-center gap-2 font-display text-2xl font-semibold">
          <Megaphone className="h-6 w-6 text-subject" /> Oznámení
        </h2>
        <p className="text-sm text-muted-foreground">
          Novinky a organizační informace ke kurzu — nejnovější nahoře.
        </p>
      </div>

      {staff && <Composer />}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Zatím žádná oznámení.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((a) => (
            <AnnouncementCard key={a.id} item={a} staff={staff} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AnnouncementCard({ item, staff }: { item: AnnouncementItem; staff: boolean }) {
  const router = useRouter();
  const del = useServerFn(deleteAnnouncement);
  const [busy, setBusy] = useState(false);
  const { confirm } = useDialog();

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Smazat oznámení „${item.title}“?`,
      message: "Oznámení bude trvale smazáno pro všechny studenty předmětu.",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await del({ data: item.id });
      toast.success("Oznámení smazáno.");
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nepodařilo se smazat oznámení.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">{item.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.authorName} · {formatDateTime(item.createdAt)}
          </p>
        </div>
        {staff && (
          <button
            onClick={handleDelete}
            disabled={busy}
            title="Smazat oznámení"
            aria-label="Smazat oznámení"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {item.body.trim() && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {item.body}
        </p>
      )}
    </li>
  );
}

function Composer() {
  const subject = subjectRoute.useLoaderData() as SubjectDetail;
  const router = useRouter();
  const create = useServerFn(createAnnouncement);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { subjectId: subject.id, title, body } });
      setTitle("");
      setBody("");
      setOpen(false);
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="subject-button inline-flex items-center gap-1.5"
      >
        <Plus className="h-4 w-4" /> Nové oznámení
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="surface-card grid gap-3 p-5">
      <h3 className="font-display font-semibold">Nové oznámení</h3>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titulek (např. Příští týden odpadá výuka)"
        required
        autoFocus
        className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Text oznámení (nepovinné)"
        rows={4}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
      />
      <div className="flex gap-2">
        <button disabled={busy} className="subject-button disabled:opacity-60">
          {busy ? "Zveřejňuji…" : "Zveřejnit"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
        >
          Zrušit
        </button>
      </div>
    </form>
  );
}
