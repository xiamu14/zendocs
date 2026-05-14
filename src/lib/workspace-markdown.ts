import { createServerFn } from '@tanstack/react-start'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import GithubSlugger from 'github-slugger'
import { getTableOfContents } from 'fumadocs-core/content/toc'
import { highlightHast } from 'fumadocs-core/highlight'
import { toHtml } from 'hast-util-to-html'
import config from '../../config'
import { matchesAnyRule } from './zendocs-config'

type MarkedTokenLike = {
  type?: string
  raw?: string
  text?: string
  lang?: string
  tokens?: MarkedTokenLike[]
  items?: Array<{ tokens?: MarkedTokenLike[] }>
}

const workspaceRoot = config.readDirectory
const maxFileSizeBytes = config.maxFileSizeBytes ?? 1024 * 1024

export type WorkspaceMarkdownPage = {
  path: string
  name: string
  title: string
  url: string
  lastUpdate: string
  content: string
  html: string
  toc: WorkspaceTocItem[]
}

export type WorkspaceNavigation = {
  root: string
  tree: WorkspaceTreeRoot
  pages: Array<Pick<WorkspaceMarkdownPage, 'path' | 'name' | 'title' | 'url'>>
  firstUrl: string | null
}

export type WorkspaceTocItem = {
  title: string
  url: string
  depth: number
}

type WorkspaceTreeRoot = {
  $id: string
  name: string
  children: WorkspaceTreeNode[]
}

type WorkspaceTreeNode = WorkspaceTreePage | WorkspaceTreeFolder

type WorkspaceTreePage = {
  type: 'page'
  name: string
  url: string
}

type WorkspaceTreeFolder = {
  type: 'folder'
  name: string
  defaultOpen: boolean
  collapsible: boolean
  children: WorkspaceTreeNode[]
}

function shouldSkipFile(fileName: string, relativePath: string) {
  if (!fileName.toLowerCase().endsWith('.md')) return true

  const stem = fileName.slice(0, -'.md'.length)
  const relativeStem = relativePath.slice(0, -'.md'.length)

  return matchesAnyRule(config.filterFiles, [
    fileName,
    stem,
    relativePath,
    relativeStem,
  ])
}

function shouldSkipDirectory(directoryName: string, relativePath: string) {
  return matchesAnyRule(config.filterDirectories, [directoryName, relativePath])
}

function encodePagePath(relativePath: string) {
  return relativePath
    .split(path.sep)
    .map((segment) => decodeURI(encodeURIComponent(segment)))
    .join('/')
}

function pageUrl(lang: string, relativePath: string) {
  return `/${lang}/${encodePagePath(relativePath)}`
}

function pageTitle(relativePath: string) {
  const name = path.basename(relativePath, '.md')
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .join(' ')
}

async function walkMarkdownFiles(directory: string, root: string, files: string[]) {
  const entries = await readdir(directory, { withFileTypes: true })

  await Promise.all(
    entries.map(async (entry) => {
      if (entry.name.startsWith('.') && entry.name !== '.agents') return

      const absolutePath = path.join(directory, entry.name)
      const relativePath = path.relative(root, absolutePath)

      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name, relativePath)) return
        await walkMarkdownFiles(absolutePath, root, files)
        return
      }

      if (!entry.isFile() || shouldSkipFile(entry.name, relativePath)) return

      const info = await stat(absolutePath)
      if (info.size > maxFileSizeBytes) return

      files.push(relativePath)
    }),
  )
}

async function getMarkdownPaths() {
  const files: string[] = []

  await walkMarkdownFiles(workspaceRoot, workspaceRoot, files)

  return files.sort((a, b) => a.localeCompare(b))
}

function insertIntoTree(
  children: WorkspaceTreeNode[],
  parts: string[],
  page: WorkspaceTreePage,
) {
  const [part, ...rest] = parts
  if (!part) return

  if (rest.length === 0) {
    children.push(page)
    return
  }

  let folder = children.find(
    (node): node is WorkspaceTreeFolder =>
      node.type === 'folder' && node.name === part,
  )

  if (!folder) {
    folder = {
      type: 'folder',
      name: part,
      defaultOpen: false,
      collapsible: true,
      children: [],
    }
    children.push(folder)
  }

  insertIntoTree(folder.children, rest, page)
}

function buildTree(files: string[], lang: string): WorkspaceTreeRoot {
  const tree: WorkspaceTreeRoot = {
    $id: `workspace:${lang}`,
    name: 'Zendocs',
    children: [],
  }

  for (const relativePath of files) {
    insertIntoTree(tree.children, relativePath.split(path.sep), {
      type: 'page',
      name: pageTitle(relativePath),
      url: pageUrl(lang, relativePath),
    })
  }

  return tree
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function parseCodeMeta(info?: string) {
  const [language = 'txt', ...meta] = (info ?? '').trim().split(/\s+/)
  const metaText = meta.join(' ')
  const title =
    /(?:title|filename)=["']?([^"'\s]+)["']?/.exec(metaText)?.[1] ?? undefined

  return {
    language: language || 'txt',
    title,
  }
}

function withPreClass(html: string) {
  return html.replace(
    '<pre class="',
    '<pre class="min-w-full w-max *:flex *:flex-col ',
  )
}

async function renderCodeBlock(code: string, info?: string) {
  const { language, title } = parseCodeMeta(info)
  let highlighted: string

  try {
    highlighted = toHtml(
      await highlightHast(code, {
        lang: language as never,
        fallbackLanguage: 'txt' as never,
        defaultColor: false,
      }),
    )
  } catch {
    highlighted = `<pre class="min-w-full w-max *:flex *:flex-col shiki"><code>${escapeHtml(code)}</code></pre>`
  }

  const header = title
    ? `<div class="flex text-fd-muted-foreground items-center gap-2 h-9.5 border-b px-4"><figcaption class="flex-1 truncate">${escapeHtml(title)}</figcaption></div>`
    : ''

  return `<figure dir="ltr" tabindex="-1" class="my-4 bg-fd-card rounded-xl shiki relative border shadow-sm not-prose overflow-hidden text-sm">${header}<div role="region" tabindex="0" class="text-[0.8125rem] py-3.5 overflow-auto max-h-[600px] fd-scroll-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-ring">${withPreClass(highlighted)}</div></figure>`
}

function collectCodeTokens(tokens: MarkedTokenLike[]) {
  const output: Array<{ key: string; text: string; lang?: string }> = []

  function visit(tokenList: MarkedTokenLike[]) {
    for (const token of tokenList) {
      if (token.type === 'code' && token.raw && typeof token.text === 'string') {
        output.push({
          key: token.raw,
          text: token.text,
          lang: token.lang,
        })
      }

      if ('tokens' in token && Array.isArray(token.tokens)) {
        visit(token.tokens)
      }

      if ('items' in token && Array.isArray(token.items)) {
        for (const item of token.items) {
          if ('tokens' in item && Array.isArray(item.tokens)) {
            visit(item.tokens)
          }
        }
      }
    }
  }

  visit(tokens)
  return output
}

async function renderMarkdown(content: string) {
  const [{ marked }, toc] = await Promise.all([
    import('marked'),
    Promise.resolve(getTableOfContents(content)),
  ])
  const tokens = marked.lexer(content)
  const highlightedBlocks = new Map<string, string>()
  const codeTokens = collectCodeTokens(tokens)

  await Promise.all(
    codeTokens.map(async (token) => {
      highlightedBlocks.set(token.key, await renderCodeBlock(token.text, token.lang))
    }),
  )

  const slugger = new GithubSlugger()
  const renderer = new marked.Renderer()

  renderer.code = (token) =>
    highlightedBlocks.get(token.raw) ?? `<pre><code>${escapeHtml(token.text)}</code></pre>`

  renderer.heading = ({ tokens, depth }) => {
    const text = tokens
      .map((token) => 'text' in token && typeof token.text === 'string' ? token.text : '')
      .join('')
    const html = renderer.parser.parseInline(tokens)
    const id = slugger.slug(text)

    return `<h${depth} id="${escapeHtml(id)}">${html}</h${depth}>`
  }

  return {
    html: marked.parser(tokens, { renderer }),
    toc: toc.map((item) => ({
      title: String(item.title),
      url: item.url,
      depth: item.depth,
    })),
  }
}

export const getWorkspaceNavigation = createServerFn({ method: 'GET' })
  .inputValidator((data: { lang: string }) => data)
  .handler(async ({ data }): Promise<WorkspaceNavigation> => {
    const files = await getMarkdownPaths()
    const pages = files.map((relativePath) => ({
      path: relativePath,
      name: path.basename(relativePath),
      title: pageTitle(relativePath),
      url: pageUrl(data.lang, relativePath),
    }))

    return {
      root: workspaceRoot,
      tree: buildTree(files, data.lang),
      pages,
      firstUrl: pages[0]?.url ?? null,
    }
  })

export const getWorkspaceMarkdownPage = createServerFn({ method: 'GET' })
  .inputValidator((data: { lang: string; pagePath: string }) => data)
  .handler(async ({ data }): Promise<WorkspaceMarkdownPage | null> => {
    const normalizedPath = decodeURIComponent(data.pagePath)
    const files = await getMarkdownPaths()
    const relativePath = files.find((file) => file === normalizedPath)

    if (!relativePath) return null

    const absolutePath = path.join(workspaceRoot, relativePath)
    const [content, fileInfo] = await Promise.all([
      readFile(absolutePath, 'utf8'),
      stat(absolutePath),
    ])
    const { html, toc } = await renderMarkdown(content)

    return {
      path: relativePath,
      name: path.basename(relativePath),
      title: pageTitle(relativePath),
      url: pageUrl(data.lang, relativePath),
      lastUpdate: fileInfo.mtime.toISOString(),
      content,
      html,
      toc,
    }
  })
