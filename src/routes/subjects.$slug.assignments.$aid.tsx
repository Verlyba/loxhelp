import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Download, History, Upload, Users2, ChevronLeft, Plus, Shuffle } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { getAssignment, getAssignmentStudents } from "@/lib/data";
import { uploadSubmission, downloadSubmission, createGroup, generatePairs } from "@/lib/actions";
import { useUser } from "@/lib/use-user";
import { isStaff } from "@/lib/roles";
import { formatDateTime, formatBytes } from "@/lib/format";
import type { AssignmentDetail, GroupView } from "@/lib/types";

export const Route = createFileRoute("/subjects/$slug/assignments/$aid")({
  beforeLoad: ({ context }) => {
    requireUser(context.user);
  },
  loader: ({ params }) => getAssignment({ data: params.aid }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.title} — Školka` }] : [],
  }),
  component: AssignmentPage,
});

function triggerDownload(fileName: string, mimeType: string, base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function AssignmentPage() {
  const assignment = Route.useLoaderData() as AssignmentDetail;
  const { slug } = Route.useParams();
  const user = useUser();
  const staff = !!user && isStaff(user.role);

  return (
    <main>
      <Link
        to="/subjects/$slug"
        params={{ slug }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Zpět na úkoly
      </Link>

      <header className="mt-4 max-w-2xl">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold">{assignment.title}</h1>
        <p className="mt-2 text-muted-foreground">{assignment.description}</p>
        <p className="mt-3 text-sm mono text-muted-foreground">
          Termín {formatDateTime(assignment.dueAt)}
        </p>
      </header>

      {assignment.canUpload && assignment.myGroupId && (
        <UploadCard groupId={assignment.myGroupId} />
      )}

      <section className="mt-10 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Users2 className="h-5 w-5 text-subject" /> {staff ? "Skupiny" : "Moje skupina"}
          </h2>
          {staff && (
            <div className="flex flex-wrap items-center gap-2">
              <GeneratePairsButton assignmentId={assignment.id} />
              <CreateGroupButton assignmentId={assignment.id} />
            </div>
          )}
        </div>

        {!staff && assignment.groups.length > 0 && (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Verze vidí a stahují všichni členové skupiny — když parťák chybí, navážete na jeho
            poslední nahranou verzi.
          </p>
        )}

        {assignment.groups.length === 0 ? (
          <p className="text-muted-foreground">
            {staff ? "Zatím žádné skupiny — vytvořte první." : "Nejste zařazeni do žádné skupiny."}
          </p>
        ) : (
          <div className="grid gap-4">
            {assignment.groups.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function UploadCard({ groupId }: { groupId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const uploadFn = useServerFn(uploadSubmission);
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Vyberte soubor.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("groupId", groupId);
      fd.set("file", file);
      if (note) fd.set("note", note);
      await uploadFn({ data: fd });
      setNote("");
      if (fileRef.current) fileRef.current.value = "";
      await router.invalidate();
      qc.invalidateQueries({ queryKey: ["student-panel"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nahrání selhalo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface-card mt-6 p-5">
      <h2 className="font-display font-semibold flex items-center gap-2">
        <Upload className="h-4 w-4 text-subject" /> Odevzdat novou verzi
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-3">
          <input
            ref={fileRef}
            type="file"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-subject file:px-3 file:py-2 file:text-sm file:font-medium file:text-[color:var(--subject-foreground)]"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Poznámka k verzi (nepovinné)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <button
          disabled={busy}
          className="subject-button inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" /> {busy ? "Nahrávám…" : "Nahrát"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}

function GroupCard({ group }: { group: GroupView }) {
  const downloadFn = useServerFn(downloadSubmission);
  const [downloading, setDownloading] = useState<string | null>(null);
  const latest = group.versions[0];

  const download = async (id: string) => {
    setDownloading(id);
    try {
      const res = await downloadFn({ data: id });
      triggerDownload(res.fileName, res.mimeType, res.dataBase64);
    } finally {
      setDownloading(null);
    }
  };

  // Per-member contribution: how many versions each member uploaded. Shows the
  // teacher (and the pair itself) who does more and who does less.
  const uploadCounts = new Map<string, number>();
  for (const v of group.versions) {
    uploadCounts.set(v.uploadedById, (uploadCounts.get(v.uploadedById) ?? 0) + 1);
  }

  return (
    <article className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div className="min-w-0">
          <p className="font-medium">{group.name}</p>
          {group.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bez členů</p>
          ) : (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {group.members.map((m) => {
                const count = uploadCounts.get(m.id) ?? 0;
                return (
                  <span
                    key={m.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                      count > 0
                        ? "bg-subject-soft text-foreground ring-1 ring-subject/30"
                        : "bg-muted text-muted-foreground"
                    }`}
                    title={`${m.name}: ${count}× nahráno`}
                  >
                    {m.name}
                    <span
                      className={`font-semibold ${count === 0 ? "opacity-60" : "text-subject"}`}
                    >
                      ×{count}
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {latest ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="subject-chip">v{latest.version} poslední</span>
            <span className="text-muted-foreground">
              {latest.uploadedByName} · {formatDateTime(latest.uploadedAt)}
            </span>
            <button
              onClick={() => download(latest.id)}
              disabled={downloading === latest.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-60"
            >
              <Download className="h-4 w-4" /> {downloading === latest.id ? "…" : "Stáhnout"}
            </button>
          </div>
        ) : (
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            Zatím neodevzdáno
          </span>
        )}
      </div>

      {group.versions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-5 pt-4 text-xs uppercase tracking-wider text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Historie verzí
          </div>
          <ul className="divide-y divide-border">
            {group.versions.map((v) => (
              <li
                key={v.id}
                className="grid gap-2 px-5 py-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center sm:gap-4 text-sm"
              >
                <span className="mono inline-flex h-6 items-center justify-center rounded bg-muted px-2 text-xs font-medium">
                  v{v.version}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium mono">{v.fileName}</p>
                  {v.note && <p className="text-xs text-muted-foreground truncate">„{v.note}"</p>}
                </div>
                <span className="text-muted-foreground text-xs">
                  {v.uploadedByName} · {formatDateTime(v.uploadedAt)} · {formatBytes(v.fileSize)}
                </span>
                <button
                  onClick={() => download(v.id)}
                  disabled={downloading === v.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" /> {downloading === v.id ? "…" : "Stáhnout"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

/** One click: split enrolled students without a group into random pairs. */
function GeneratePairsButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const generate = useServerFn(generatePairs);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await generate({ data: assignmentId });
      setResult(
        res.grouped === 0
          ? "Všichni studenti už mají skupinu."
          : `Rozlosováno: ${res.grouped} studentů do ${res.created} skupin.`,
      );
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-60"
      >
        <Shuffle className="h-4 w-4" /> {busy ? "Losuji…" : "Rozlosovat dvojice"}
      </button>
    </div>
  );
}

function CreateGroupButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const create = useServerFn(createGroup);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const students = useQuery({
    queryKey: ["assignment-students", assignmentId],
    queryFn: () => getAssignmentStudents({ data: assignmentId }),
    enabled: open,
  });

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { assignmentId, name, memberIds: selected } });
      setName("");
      setSelected([]);
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
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-accent"
      >
        <Plus className="h-4 w-4" /> Nová skupina
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="surface-card w-full max-w-md p-5 grid gap-3">
      <h3 className="font-display font-semibold">Nová skupina</h3>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Název (např. Dvojice 1)"
        required
        className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
      <div className="max-h-48 overflow-y-auto rounded-md border border-border p-2">
        {students.isLoading ? (
          <p className="text-sm text-muted-foreground">Načítám studenty…</p>
        ) : (students.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádní studenti v předmětu.</p>
        ) : (
          (students.data ?? []).map((s) => (
            <label key={s.id} className="flex items-center gap-2 px-1 py-1 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(s.id)}
                onChange={() => toggle(s.id)}
              />
              <span>{s.name}</span>
              {s.inGroup && <span className="text-xs text-muted-foreground">(už ve skupině)</span>}
            </label>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <button disabled={busy} className="subject-button flex-1 disabled:opacity-60">
          {busy ? "Ukládám…" : "Vytvořit"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
        >
          Zrušit
        </button>
      </div>
    </form>
  );
}
