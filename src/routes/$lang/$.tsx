import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { MarkdownBody } from "@/components/markdown-body";
import { MermaidRenderer } from "@/components/mermaid-renderer";
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
      breadcrumb={{
        className: "zd-page-breadcrumb",
      }}
    >
      <DocsTitle>{page.headingTitle}</DocsTitle>
      {page.description ? (
        <DocsDescription className="zd-page-description">
          {page.description}
        </DocsDescription>
      ) : null}
      <MarkdownPageActions
        canOpenInEditor={page.canOpenInEditor}
        editorUrl={page.editorUrl}
        markdown={page.content}
        pagePath={page.path}
      />
      <MarkdownBody key={page.html} html={page.html} />
      <MermaidRenderer version={`${page.path}:${page.lastUpdate}`} />
    </DocsPage>
  );
}
