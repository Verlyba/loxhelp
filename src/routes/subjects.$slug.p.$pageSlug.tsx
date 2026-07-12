import { createFileRoute } from "@tanstack/react-router";
import { getSubjectPage } from "@/lib/data";
import { SubjectPageView } from "@/components/subject-page-view";
import type { SubjectPageDetail } from "@/lib/types";

export const Route = createFileRoute("/subjects/$slug/p/$pageSlug")({
  loader: ({ params }) =>
    getSubjectPage({ data: { subjectSlug: params.slug, pageSlug: params.pageSlug } }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.title} — Shtroodle` }] : [],
  }),
  component: PageRoute,
});

function PageRoute() {
  const page = Route.useLoaderData() as SubjectPageDetail;
  return <SubjectPageView page={page} />;
}
