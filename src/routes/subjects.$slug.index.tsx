import { createFileRoute, getRouteApi, Navigate } from "@tanstack/react-router";
import { useUser } from "@/lib/use-user";
import { isStaff } from "@/lib/roles";
import type { SubjectDetail } from "@/lib/types";

const subjectRoute = getRouteApi("/subjects/$slug");

// /subjects/<slug> lands on the first page in the left panel.
export const Route = createFileRoute("/subjects/$slug/")({
  component: SubjectIndex,
});

function SubjectIndex() {
  const subject = subjectRoute.useLoaderData() as SubjectDetail;
  const user = useUser();
  const first = subject.pages[0];

  if (first) {
    return (
      <Navigate
        to="/subjects/$slug/p/$pageSlug"
        params={{ slug: subject.slug, pageSlug: first.slug }}
        replace
      />
    );
  }

  return (
    <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      Tento předmět zatím nemá žádné stránky.
      {user && isStaff(user.role) && " Vytvořte první v levém panelu."}
    </p>
  );
}
