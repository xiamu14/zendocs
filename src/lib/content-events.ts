import chokidar from 'chokidar'
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import config from '../../config'
import { matchesAnyRule } from './zendocs-config'

type ContentEventType = 'add' | 'change' | 'unlink'

export type ContentEvent = {
  event: ContentEventType
  path: string
}

type ContentEventListener = (event: ContentEvent) => void

const listeners = new Set<ContentEventListener>()
let watcherStarted = false
let contentSignature: string | null = null

function isRunningInDocker() {
  return existsSync('/.dockerenv')
}

function shouldSkipContentEvent(absolutePath: string) {
  const workspaceRoot = path.resolve(config.readDirectory)
  const relativePath = path.relative(workspaceRoot, absolutePath)

  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    return true
  }

  const normalizedRelativePath = relativePath.split(path.sep).join('/')
  const parts = normalizedRelativePath.split('/')
  const fileName = parts.at(-1) ?? ''

  if (!fileName.toLowerCase().endsWith('.md')) return true

  const stem = fileName.slice(0, -'.md'.length)
  const relativeStem = normalizedRelativePath.slice(0, -'.md'.length)

  if (
    matchesAnyRule(config.filterFiles, [
      fileName,
      stem,
      normalizedRelativePath,
      relativeStem,
    ])
  ) {
    return true
  }

  return parts
    .slice(0, -1)
    .some((directoryName, index) =>
      matchesAnyRule(config.filterDirectories, [
        directoryName,
        parts.slice(0, index + 1).join('/'),
      ]),
    )
}

async function collectMarkdownFileStats(
  directory: string,
  root: string,
  output: string[],
) {
  const entries = await readdir(directory, { withFileTypes: true })

  await Promise.all(
    entries.map(async (entry) => {
      if (entry.name.startsWith('.') && entry.name !== '.agents') return

      const absolutePath = path.join(directory, entry.name)
      const relativePath = path.relative(root, absolutePath)

      if (entry.isDirectory()) {
        if (shouldIgnoreWatchPath(absolutePath)) return
        await collectMarkdownFileStats(absolutePath, root, output)
        return
      }

      if (!entry.isFile() || shouldSkipContentEvent(absolutePath)) return

      const fileInfo = await stat(absolutePath)
      output.push(`${relativePath}:${fileInfo.mtimeMs}:${fileInfo.size}`)
    }),
  )
}

async function createContentSignature() {
  const workspaceRoot = path.resolve(config.readDirectory)
  const entries: string[] = []

  await collectMarkdownFileStats(workspaceRoot, workspaceRoot, entries)

  return entries.sort((a, b) => a.localeCompare(b)).join('|')
}

function shouldIgnoreWatchPath(filePath: string) {
  const workspaceRoot = path.resolve(config.readDirectory)
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(filePath)
  const relativePath = path.relative(workspaceRoot, absolutePath)

  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    return false
  }

  const normalizedRelativePath = relativePath.split(path.sep).join('/')
  const parts = normalizedRelativePath.split('/')

  if (parts.some((part) => part.startsWith('.') && part !== '.agents')) {
    return true
  }

  return parts.some((part, index) =>
    matchesAnyRule(config.filterDirectories, [
      part,
      parts.slice(0, index + 1).join('/'),
    ]),
  )
}

function startContentWatcher() {
  if (watcherStarted) return
  watcherStarted = true

  const workspaceRoot = path.resolve(config.readDirectory)
  const usePolling = isRunningInDocker()

  const watcher = chokidar.watch(path.join(workspaceRoot, '**/*.md'), {
    ignored: shouldIgnoreWatchPath,
    ignoreInitial: true,
    interval: 500,
    usePolling,
  })

  const emit = (event: ContentEventType, filePath: string) => {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(filePath)

    if (shouldSkipContentEvent(absolutePath)) return

    const contentEvent = {
      event,
      path: path.relative(workspaceRoot, absolutePath).split(path.sep).join('/'),
    }

    contentSignature = null

    for (const listener of listeners) {
      listener(contentEvent)
    }
  }

  watcher.on('add', (filePath) => emit('add', filePath))
  watcher.on('change', (filePath) => emit('change', filePath))
  watcher.on('unlink', (filePath) => emit('unlink', filePath))
}

export function subscribeToContentEvents(listener: ContentEventListener) {
  startContentWatcher()
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export async function getContentVersion() {
  startContentWatcher()

  contentSignature ??= await createContentSignature()

  return contentSignature
}
