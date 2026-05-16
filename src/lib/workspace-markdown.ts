import { createServerFn } from "@tanstack/react-start";
import type {
  OpenWorkspaceMarkdownInEditorResult,
  WorkspaceMarkdownPage,
  WorkspaceNavigation,
} from "./workspace-markdown.server";

type SearchWorkspaceMarkdownInput = {
  lang: string;
  query: string;
  filter?: string;
  limit?: number;
};

export type {
  OpenWorkspaceMarkdownInEditorResult,
  WorkspaceMarkdownPage,
  WorkspaceNavigation,
  WorkspaceTocItem,
} from "./workspace-markdown.server";

export const searchWorkspaceMarkdownServer = createServerFn({ method: "GET" })
  .inputValidator((data: SearchWorkspaceMarkdownInput) => data)
  .handler(async ({ data }) => {
    const { searchWorkspaceMarkdown } = await import(
      "./workspace-markdown.server"
    );

    return searchWorkspaceMarkdown(data);
  });

export const getWorkspaceSearchFilters = createServerFn({
  method: "GET",
}).handler(async () => {
  const { getWorkspaceSearchFilters } = await import(
    "./workspace-markdown.server"
  );

  return getWorkspaceSearchFilters();
});

export const getWorkspaceNavigation = createServerFn({ method: "GET" })
  .inputValidator((data: { lang: string }) => data)
  .handler(async ({ data }): Promise<WorkspaceNavigation> => {
    const { getWorkspaceNavigationData } = await import(
      "./workspace-markdown.server"
    );

    return getWorkspaceNavigationData(data);
  });

export const openWorkspaceMarkdownInEditor = createServerFn({ method: "POST" })
  .inputValidator((data: { pagePath: string }) => data)
  .handler(async ({ data }): Promise<OpenWorkspaceMarkdownInEditorResult> => {
    const { openWorkspaceMarkdownInEditorData } = await import(
      "./workspace-markdown.server"
    );

    return openWorkspaceMarkdownInEditorData(data);
  });

export const getWorkspaceMarkdownPage = createServerFn({ method: "GET" })
  .inputValidator((data: { lang: string; pagePath: string }) => data)
  .handler(async ({ data }): Promise<WorkspaceMarkdownPage | null> => {
    const { getWorkspaceMarkdownPageData } = await import(
      "./workspace-markdown.server"
    );

    return getWorkspaceMarkdownPageData(data);
  });
