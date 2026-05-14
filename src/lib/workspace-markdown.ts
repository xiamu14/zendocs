import { createServerFn } from "@tanstack/react-start";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import GithubSlugger from "github-slugger";
import type { SortedResult } from "fumadocs-core/search";
import { getTableOfContents } from "fumadocs-core/content/toc";
import { highlightHast } from "fumadocs-core/highlight";
import { toHtml } from "hast-util-to-html";
import config from "../../config";
import { matchesAnyRule } from "./zendocs-config";

type MarkedTokenLike = {
  type?: string;
  raw?: string;
  text?: string;
  depth?: number;
  lang?: string;
  tokens?: MarkedTokenLike[];
  items?: Array<{ tokens?: MarkedTokenLike[] }>;
};

const workspaceRoot = config.readDirectory;
const maxFileSizeBytes = config.maxFileSizeBytes ?? 1024 * 1024;

export type WorkspaceMarkdownPage = {
  path: string;
  name: string;
  title: string;
  headingTitle: string;
  url: string;
  lastUpdate: string;
  content: string;
  html: string;
  toc: WorkspaceTocItem[];
  canOpenInEditor: boolean;
  editorUrl: string | null;
};

export type WorkspaceNavigation = {
  root: string;
  tree: WorkspaceTreeRoot;
  pages: Array<Pick<WorkspaceMarkdownPage, "path" | "name" | "title" | "url">>;
  firstUrl: string | null;
};

export type OpenWorkspaceMarkdownInEditorResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      message: string;
    };

export type WorkspaceTocItem = {
  title: string;
  url: string;
  depth: number;
};

type WorkspaceTreeRoot = {
  $id: string;
  name: string;
  children: WorkspaceTreeNode[];
};

type WorkspaceTreeNode =
  | WorkspaceTreePage
  | WorkspaceTreeFolder
  | WorkspaceTreeSeparator;

type WorkspaceTreePage = {
  type: "page";
  name: string;
  url: string;
};

type WorkspaceTreeFolder = {
  type: "folder";
  name: string;
  defaultOpen: boolean;
  collapsible: boolean;
  children: WorkspaceTreeNode[];
};

type WorkspaceTreeSeparator = {
  type: "separator";
  name: string;
};

type WorkspaceSearchDocument = {
  path: string;
  title: string;
  url: string;
  content: string;
  searchableContent: string;
  breadcrumbs: string[];
  headings: Array<{
    title: string;
    url: string;
    depth: number;
  }>;
};

type WorkspaceSearchCache = {
  signature: string;
  checkedAt: number;
  documents: WorkspaceSearchDocument[];
};

const searchCacheTtlMs = 2000;
let workspaceSearchCache: WorkspaceSearchCache | null = null;

function isRunningInDocker() {
  return existsSync("/.dockerenv");
}

function canOpenWorkspaceMarkdownInEditor() {
  return Boolean(config.editor) && (!isRunningInDocker() || Boolean(config.editor.url));
}

function buildEditorUrl(absolutePath: string) {
  const editor = config.editor;
  if (!editor || !editor.url) return null;

  const encodedPath = absolutePath
    .split(path.sep)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return editor.url.replaceAll("{file}", encodedPath);
}

function shouldSkipFile(fileName: string, relativePath: string) {
  if (!fileName.toLowerCase().endsWith(".md")) return true;

  const stem = fileName.slice(0, -".md".length);
  const relativeStem = relativePath.slice(0, -".md".length);

  return matchesAnyRule(config.filterFiles, [
    fileName,
    stem,
    relativePath,
    relativeStem,
  ]);
}

function shouldSkipDirectory(directoryName: string, relativePath: string) {
  return matchesAnyRule(config.filterDirectories, [
    directoryName,
    relativePath,
  ]);
}

function encodePagePath(relativePath: string) {
  return relativePath
    .split(path.sep)
    .map((segment) => decodeURI(encodeURIComponent(segment)))
    .join("/");
}

function pageUrl(lang: string, relativePath: string) {
  return `/${lang}/${encodePagePath(relativePath)}`;
}

function pageTitle(relativePath: string) {
  const name = path.basename(relativePath, ".md");
  return name.split(/[-_]/).filter(Boolean).join(" ");
}

function groupTitle(directoryName: string) {
  return directoryName.charAt(0).toLocaleUpperCase() + directoryName.slice(1);
}

function pageBreadcrumbs(relativePath: string) {
  const directory = path.dirname(relativePath);
  if (directory === ".") return [];

  return directory.split(path.sep).filter(Boolean);
}

function isPathInsideWorkspace(absolutePath: string) {
  const relativePath = path.relative(path.resolve(workspaceRoot), absolutePath);

  return (
    Boolean(relativePath) &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
}

function buildEditorArgs(args: string[] | undefined, absolutePath: string) {
  if (!args || args.length === 0) return [absolutePath];

  let usedFilePlaceholder = false;
  const editorArgs = args.map((arg) => {
    if (!arg.includes("{file}")) return arg;

    usedFilePlaceholder = true;
    return arg.replaceAll("{file}", absolutePath);
  });

  return usedFilePlaceholder ? editorArgs : [...editorArgs, absolutePath];
}

async function walkMarkdownFiles(
  directory: string,
  root: string,
  files: string[],
) {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      if (entry.name.startsWith(".") && entry.name !== ".agents") return;

      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath);

      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name, relativePath)) return;
        await walkMarkdownFiles(absolutePath, root, files);
        return;
      }

      if (!entry.isFile() || shouldSkipFile(entry.name, relativePath)) return;

      const info = await stat(absolutePath);
      if (info.size > maxFileSizeBytes) return;

      files.push(relativePath);
    }),
  );
}

async function getMarkdownPaths() {
  const files: string[] = [];

  await walkMarkdownFiles(workspaceRoot, workspaceRoot, files);

  return files.sort((a, b) => a.localeCompare(b));
}

function insertIntoTree(
  children: WorkspaceTreeNode[],
  parts: string[],
  page: WorkspaceTreePage,
) {
  const [part, ...rest] = parts;
  if (!part) return;

  if (rest.length === 0) {
    children.push(page);
    return;
  }

  let folder = children.find(
    (node): node is WorkspaceTreeFolder =>
      node.type === "folder" && node.name === part,
  );

  if (!folder) {
    folder = {
      type: "folder",
      name: part,
      defaultOpen: false,
      collapsible: true,
      children: [],
    };
    children.push(folder);
  }

  insertIntoTree(folder.children, rest, page);
}

function buildTree(files: string[], lang: string): WorkspaceTreeRoot {
  const tree: WorkspaceTreeRoot = {
    $id: `workspace:${lang}`,
    name: "Zendocs",
    children: [],
  };
  const groupedFiles = new Map<string, string[]>();

  for (const relativePath of files) {
    const parts = relativePath.split(path.sep);

    if (parts.length === 1) {
      insertIntoTree(tree.children, parts, {
        type: "page",
        name: pageTitle(relativePath),
        url: pageUrl(lang, relativePath),
      });
      continue;
    }

    const [groupName, ...rest] = parts;
    if (!groupName) continue;

    const groupFiles = groupedFiles.get(groupName) ?? [];
    groupFiles.push(rest.join(path.sep));
    groupedFiles.set(groupName, groupFiles);
  }

  for (const [groupName, groupFiles] of groupedFiles) {
    tree.children.push({
      type: "separator",
      name: groupTitle(groupName),
    });

    for (const relativePathWithinGroup of groupFiles) {
      const relativePath = path.join(groupName, relativePathWithinGroup);

      insertIntoTree(tree.children, relativePathWithinGroup.split(path.sep), {
        type: "page",
        name: pageTitle(relativePath),
        url: pageUrl(lang, relativePath),
      });
    }
  }

  return tree;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function tokenText(tokens: MarkedTokenLike[] | undefined): string {
  if (!tokens) return "";

  return tokens
    .map((token) => {
      if (typeof token.text === "string") return token.text;
      if (Array.isArray(token.tokens)) return tokenText(token.tokens);
      return "";
    })
    .join("");
}

function collectPlainText(tokens: MarkedTokenLike[]) {
  const output: string[] = [];

  function visit(tokenList: MarkedTokenLike[]) {
    for (const token of tokenList) {
      if (typeof token.text === "string") output.push(token.text);

      if (Array.isArray(token.tokens)) {
        visit(token.tokens);
      }

      if (Array.isArray(token.items)) {
        for (const item of token.items) {
          if (Array.isArray(item.tokens)) visit(item.tokens);
        }
      }
    }
  }

  visit(tokens);
  return output.join(" ");
}

async function parseSearchContent(content: string) {
  const { marked } = await import("marked");
  const tokens = marked.lexer(content);
  const slugger = new GithubSlugger();
  const headings: WorkspaceSearchDocument["headings"] = [];

  for (const token of tokens) {
    if (token.type !== "heading") continue;

    const title = tokenText(token.tokens as MarkedTokenLike[]) || token.text;
    if (!title) continue;

    headings.push({
      title,
      url: `#${slugger.slug(title)}`,
      depth: token.depth,
    });
  }

  return {
    searchableContent: collectPlainText(tokens as MarkedTokenLike[]),
    headings,
  };
}

async function getWorkspaceSearchDocuments(lang: string) {
  const now = Date.now();
  if (
    workspaceSearchCache &&
    now - workspaceSearchCache.checkedAt < searchCacheTtlMs
  ) {
    return workspaceSearchCache.documents.map((document) => ({
      ...document,
      url: pageUrl(lang, document.path),
      headings: document.headings.map((heading) => ({
        ...heading,
        url: `${pageUrl(lang, document.path)}${heading.url}`,
      })),
    }));
  }

  const files = await getMarkdownPaths();
  const fileStats = await Promise.all(
    files.map(async (relativePath) => ({
      relativePath,
      info: await stat(path.join(workspaceRoot, relativePath)),
    })),
  );
  const signature = fileStats
    .map(
      ({ relativePath, info }) =>
        `${relativePath}:${info.mtimeMs}:${info.size}`,
    )
    .join("|");

  if (workspaceSearchCache?.signature === signature) {
    workspaceSearchCache.checkedAt = now;
    return workspaceSearchCache.documents.map((document) => ({
      ...document,
      url: pageUrl(lang, document.path),
      headings: document.headings.map((heading) => ({
        ...heading,
        url: `${pageUrl(lang, document.path)}${heading.url}`,
      })),
    }));
  }

  const documents = await Promise.all(
    fileStats.map(async ({ relativePath }) => {
      const content = await readFile(
        path.join(workspaceRoot, relativePath),
        "utf8",
      );
      const { searchableContent, headings } = await parseSearchContent(content);

      return {
        path: relativePath,
        title: pageTitle(relativePath),
        url: pageUrl(lang, relativePath),
        content,
        searchableContent,
        breadcrumbs: pageBreadcrumbs(relativePath),
        headings,
      };
    }),
  );

  workspaceSearchCache = {
    signature,
    checkedAt: now,
    documents,
  };

  return documents.map((document) => ({
    ...document,
    url: pageUrl(lang, document.path),
    headings: document.headings.map((heading) => ({
      ...heading,
      url: `${pageUrl(lang, document.path)}${heading.url}`,
    })),
  }));
}

function firstMatchIndex(value: string, terms: string[]) {
  const normalized = normalizeSearchText(value);
  let bestIndex = -1;

  for (const term of terms) {
    const index = normalized.indexOf(term);
    if (index === -1) continue;
    if (bestIndex === -1 || index < bestIndex) bestIndex = index;
  }

  return bestIndex;
}

function highlightMatches(value: string, terms: string[]) {
  if (terms.length === 0) return escapeHtml(value);

  const pattern = new RegExp(
    `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );

  return escapeHtml(value).replace(pattern, "<mark>$1</mark>");
}

function createSnippet(value: string, terms: string[]) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();
  const index = firstMatchIndex(normalizedValue, terms);
  const start = Math.max(0, index - 48);
  const end =
    index === -1 ? 140 : Math.min(normalizedValue.length, index + 120);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalizedValue.length ? "..." : "";

  return `${prefix}${highlightMatches(normalizedValue.slice(start, end), terms)}${suffix}`;
}

function scoreMatch(value: string, terms: string[], weight: number) {
  const normalized = normalizeSearchText(value);
  let score = 0;

  for (const term of terms) {
    const index = normalized.indexOf(term);
    if (index === -1) continue;

    score += weight;
    if (index === 0) score += Math.round(weight / 2);
  }

  return score;
}

async function searchWorkspaceMarkdown({
  lang,
  query,
  filter,
  limit = 20,
}: {
  lang: string;
  query: string;
  filter?: string;
  limit?: number;
}): Promise<SortedResult[]> {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  if (terms.length === 0) return [];

  const documents = (await getWorkspaceSearchDocuments(lang)).filter(
    (document) => !filter || document.breadcrumbs[0] === filter,
  );
  const results: Array<SortedResult & { score: number }> = [];

  for (const document of documents) {
    const titleScore =
      scoreMatch(document.title, terms, 70) +
      scoreMatch(document.path, terms, 45);

    if (titleScore > 0) {
      results.push({
        id: `page:${document.path}`,
        type: "page",
        url: document.url,
        breadcrumbs: document.breadcrumbs,
        content: highlightMatches(document.title, terms),
        score: titleScore,
      });
    }

    for (const heading of document.headings) {
      const headingScore = scoreMatch(heading.title, terms, 55);

      if (headingScore > 0) {
        results.push({
          id: `heading:${document.path}:${heading.url}`,
          type: "heading",
          url: heading.url,
          content: highlightMatches(heading.title, terms),
          score: headingScore + Math.max(0, 6 - heading.depth),
        });
      }
    }

    const contentScore = scoreMatch(document.searchableContent, terms, 18);

    if (contentScore > 0) {
      results.push({
        id: `text:${document.path}`,
        type: "text",
        url: document.url,
        content: createSnippet(document.searchableContent, terms),
        score: contentScore,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .slice(0, limit)
    .map(({ score: _, ...result }) => result);
}

export const searchWorkspaceMarkdownServer = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { lang: string; query: string; filter?: string; limit?: number }) =>
      data,
  )
  .handler(({ data }) => searchWorkspaceMarkdown(data));

export const getWorkspaceSearchFilters = createServerFn({
  method: "GET",
}).handler(async () => {
  const files = await getMarkdownPaths();
  const filters = new Set<string>();

  for (const relativePath of files) {
    const [first, ...rest] = relativePath.split(path.sep);
    if (first && rest.length > 0) filters.add(first);
  }

  return Array.from(filters).sort((a, b) => a.localeCompare(b));
});

function parseCodeMeta(info?: string) {
  const [language = "txt", ...meta] = (info ?? "").trim().split(/\s+/);
  const metaText = meta.join(" ");
  const title =
    /(?:title|filename)=["']?([^"'\s]+)["']?/.exec(metaText)?.[1] ?? undefined;

  return {
    language: language || "txt",
    title,
  };
}

function withPreClass(html: string) {
  return html.replace(
    '<pre class="',
    '<pre class="min-w-full w-max *:flex *:flex-col ',
  );
}

async function renderCodeBlock(code: string, info?: string) {
  const { language, title } = parseCodeMeta(info);
  let highlighted: string;

  try {
    highlighted = toHtml(
      await highlightHast(code, {
        lang: language as never,
        fallbackLanguage: "txt" as never,
        themes: {
          light: "catppuccin-latte",
          dark: "catppuccin-mocha",
        },
        defaultColor: false,
      }),
    );
  } catch {
    highlighted = `<pre class="min-w-full w-max *:flex *:flex-col shiki"><code>${escapeHtml(code)}</code></pre>`;
  }

  const header = title
    ? `<div class="flex text-fd-muted-foreground items-center gap-2 h-9.5 border-b px-4"><figcaption class="flex-1 truncate">${escapeHtml(title)}</figcaption></div>`
    : "";

  return `<figure dir="ltr" tabindex="-1" class="my-4 bg-fd-card rounded-xl shiki relative border shadow-sm not-prose overflow-hidden text-sm">${header}<div role="region" tabindex="0" class="text-[0.8125rem] py-3.5 overflow-auto max-h-[600px] fd-scroll-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-ring">${withPreClass(highlighted)}</div></figure>`;
}

function collectCodeTokens(tokens: MarkedTokenLike[]) {
  const output: Array<{ key: string; text: string; lang?: string }> = [];

  function visit(tokenList: MarkedTokenLike[]) {
    for (const token of tokenList) {
      if (
        token.type === "code" &&
        token.raw &&
        typeof token.text === "string"
      ) {
        output.push({
          key: token.raw,
          text: token.text,
          lang: token.lang,
        });
      }

      if ("tokens" in token && Array.isArray(token.tokens)) {
        visit(token.tokens);
      }

      if ("items" in token && Array.isArray(token.items)) {
        for (const item of token.items) {
          if ("tokens" in item && Array.isArray(item.tokens)) {
            visit(item.tokens);
          }
        }
      }
    }
  }

  visit(tokens);
  return output;
}

async function renderMarkdown(content: string) {
  const [{ marked }, toc] = await Promise.all([
    import("marked"),
    Promise.resolve(getTableOfContents(content)),
  ]);
  const tokens = marked.lexer(content) as MarkedTokenLike[];
  const firstToken = tokens[0];
  const headingTitle =
    firstToken?.type === "heading" && firstToken.depth === 1
      ? tokenText(firstToken.tokens) || firstToken.text || ""
      : "";
  const bodyTokens = headingTitle ? tokens.slice(1) : tokens;
  const highlightedBlocks = new Map<string, string>();
  const codeTokens = collectCodeTokens(bodyTokens);

  await Promise.all(
    codeTokens.map(async (token) => {
      highlightedBlocks.set(
        token.key,
        await renderCodeBlock(token.text, token.lang),
      );
    }),
  );

  const slugger = new GithubSlugger();
  const renderer = new marked.Renderer();

  renderer.code = (token) =>
    highlightedBlocks.get(token.raw) ??
    `<pre><code>${escapeHtml(token.text)}</code></pre>`;

  renderer.heading = ({ tokens, depth }) => {
    const text = tokens
      .map((token) =>
        "text" in token && typeof token.text === "string" ? token.text : "",
      )
      .join("");
    const html = renderer.parser.parseInline(tokens);
    const id = slugger.slug(text);

    return `<h${depth} id="${escapeHtml(id)}">${html}</h${depth}>`;
  };

  return {
    headingTitle,
    html: marked.parser(bodyTokens, { renderer }),
    toc: toc.map((item) => ({
      title: String(item.title),
      url: item.url,
      depth: item.depth,
    })),
  };
}

export const getWorkspaceNavigation = createServerFn({ method: "GET" })
  .inputValidator((data: { lang: string }) => data)
  .handler(async ({ data }): Promise<WorkspaceNavigation> => {
    const files = await getMarkdownPaths();
    const pages = files.map((relativePath) => ({
      path: relativePath,
      name: path.basename(relativePath),
      title: pageTitle(relativePath),
      url: pageUrl(data.lang, relativePath),
    }));

    return {
      root: workspaceRoot,
      tree: buildTree(files, data.lang),
      pages,
      firstUrl: pages[0]?.url ?? null,
    };
  });

export const openWorkspaceMarkdownInEditor = createServerFn({ method: "POST" })
  .inputValidator((data: { pagePath: string }) => data)
  .handler(async ({ data }): Promise<OpenWorkspaceMarkdownInEditorResult> => {
    const editor = config.editor;

    if (isRunningInDocker()) {
      return {
        ok: false,
        message: "Editor is not available in Docker.",
      };
    }

    if (!editor) {
      return {
        ok: false,
        message: "Editor is not configured.",
      };
    }

    const normalizedPath = decodeURIComponent(data.pagePath);
    const files = await getMarkdownPaths();
    const relativePath = files.find((file) => file === normalizedPath);

    if (!relativePath) {
      return {
        ok: false,
        message: "File is not available in this workspace.",
      };
    }

    const absolutePath = path.resolve(workspaceRoot, relativePath);

    if (!isPathInsideWorkspace(absolutePath)) {
      return {
        ok: false,
        message: "File is outside the configured workspace.",
      };
    }

    try {
      const child = spawn(
        editor.command,
        buildEditorArgs(editor.args, absolutePath),
        {
          detached: true,
          stdio: "ignore",
        },
      );

      child.unref();

      return { ok: true };
    } catch {
      return {
        ok: false,
        message: "Could not open the configured editor.",
      };
    }
  });

export const getWorkspaceMarkdownPage = createServerFn({ method: "GET" })
  .inputValidator((data: { lang: string; pagePath: string }) => data)
  .handler(async ({ data }): Promise<WorkspaceMarkdownPage | null> => {
    const normalizedPath = decodeURIComponent(data.pagePath);
    const files = await getMarkdownPaths();
    const relativePath = files.find((file) => file === normalizedPath);

    if (!relativePath) return null;

    const absolutePath = path.join(workspaceRoot, relativePath);
    const [content, fileInfo] = await Promise.all([
      readFile(absolutePath, "utf8"),
      stat(absolutePath),
    ]);
    const { headingTitle, html, toc } = await renderMarkdown(content);

    return {
      path: relativePath,
      name: path.basename(relativePath),
      title: pageTitle(relativePath),
      headingTitle: headingTitle || pageTitle(relativePath),
      url: pageUrl(data.lang, relativePath),
      lastUpdate: fileInfo.mtime.toISOString(),
      content,
      html,
      toc,
      canOpenInEditor: canOpenWorkspaceMarkdownInEditor(),
      editorUrl: buildEditorUrl(absolutePath),
    };
  });
