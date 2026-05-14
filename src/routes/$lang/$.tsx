import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsBody, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { MarkdownPageActions } from "@/components/open-editor-button";
import { getWorkspaceMarkdownPage } from "@/lib/workspace-markdown";

export const Route = createFileRoute("/$lang/$")({
  loader: async ({ params }) => {
    if (!params._splat) throw notFound();

    const page = await getWorkspaceMarkdownPage({
      data: {
        lang: params.lang,
        pagePath: params._splat,
      },
    });

    if (!page) throw notFound();

    return page;
  },
  component: WorkspaceMarkdownPage,
});

function WorkspaceMarkdownPage() {
  const page = Route.useLoaderData();

  return (
    <DocsPage
      toc={page.toc}
      lastUpdate={page.lastUpdate}
      tableOfContent={{
        style: "clerk",
      }}
    >
      <DocsTitle>{page.headingTitle}</DocsTitle>
      <MarkdownPageActions markdown={page.content} pagePath={page.path} />
      <DocsBody dangerouslySetInnerHTML={{ __html: page.html }} />
    </DocsPage>
  );
}
