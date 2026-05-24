import chokidar, { type FSWatcher } from "chokidar";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  getZendocsConfig,
  getZendocsConfigPath,
  getZendocsConfigVersion,
} from "./config-runtime.server";
import { matchesAnyRule } from "./zendocs-config";
import type { ZendocsConfig } from "./zendocs-config";
import { resetWorkspaceMarkdownCaches } from "./workspace-markdown.server";

type ContentEventType = "add" | "change" | "unlink" | "config";

export type ContentEvent = {
  event: ContentEventType;
  path: string;
};

type ContentEventListener = (event: ContentEvent) => void;

const listeners = new Set<ContentEventListener>();
let watcher: FSWatcher | null = null;
let watcherKey: string | null = null;
let watcherStartPromise: Promise<void> | null = null;
let contentSignature: string | null = null;

function isRunningInDocker() {
  return existsSync("/.dockerenv");
}

function shouldSkipContentEvent(config: ZendocsConfig, absolutePath: string) {
  const workspaceRoot = path.resolve(config.readDirectory);
  const relativePath = path.relative(workspaceRoot, absolutePath);

  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    return true;
  }

  const normalizedRelativePath = relativePath.split(path.sep).join("/");
  const parts = normalizedRelativePath.split("/");
  const fileName = parts.at(-1) ?? "";

  if (!fileName.toLowerCase().endsWith(".md")) return true;

  const stem = fileName.slice(0, -".md".length);
  const relativeStem = normalizedRelativePath.slice(0, -".md".length);

  if (
    matchesAnyRule(config.filterFiles, [
      fileName,
      stem,
      normalizedRelativePath,
      relativeStem,
    ])
  ) {
    return true;
  }

  return parts
    .slice(0, -1)
    .some((directoryName, index) =>
      matchesAnyRule(config.filterDirectories, [
        directoryName,
        parts.slice(0, index + 1).join("/"),
      ]),
    );
}

async function collectMarkdownFileStats(
  config: ZendocsConfig,
  directory: string,
  root: string,
  output: string[],
) {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      if (entry.name.startsWith(".") && entry.name !== ".agents") return;

      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath);

      if (entry.isDirectory()) {
        if (shouldIgnoreWatchPath(config, absolutePath)) return;
        await collectMarkdownFileStats(config, absolutePath, root, output);
        return;
      }

      if (!entry.isFile() || shouldSkipContentEvent(config, absolutePath)) {
        return;
      }

      const fileInfo = await stat(absolutePath);
      output.push(`${relativePath}:${fileInfo.mtimeMs}:${fileInfo.size}`);
    }),
  );
}

async function createContentSignature() {
  const [config, configVersion] = await Promise.all([
    getZendocsConfig(),
    getZendocsConfigVersion(),
  ]);
  const workspaceRoot = path.resolve(config.readDirectory);
  const entries: string[] = [configVersion];

  await collectMarkdownFileStats(config, workspaceRoot, workspaceRoot, entries);

  return entries.sort((a, b) => a.localeCompare(b)).join("|");
}

function shouldIgnoreWatchPath(config: ZendocsConfig, filePath: string) {
  const workspaceRoot = path.resolve(config.readDirectory);
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(filePath);
  const relativePath = path.relative(workspaceRoot, absolutePath);

  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    return false;
  }

  const normalizedRelativePath = relativePath.split(path.sep).join("/");
  const parts = normalizedRelativePath.split("/");

  if (parts.some((part) => part.startsWith(".") && part !== ".agents")) {
    return true;
  }

  return parts.some((part, index) =>
    matchesAnyRule(config.filterDirectories, [
      part,
      parts.slice(0, index + 1).join("/"),
    ]),
  );
}

function emitContentEvent(contentEvent: ContentEvent) {
  for (const listener of listeners) {
    listener(contentEvent);
  }
}

async function configureContentWatcher() {
  const [config, configVersion] = await Promise.all([
    getZendocsConfig(),
    getZendocsConfigVersion(),
  ]);
  const workspaceRoot = path.resolve(config.readDirectory);
  const nextWatcherKey = `${configVersion}:${workspaceRoot}`;

  if (watcherKey === nextWatcherKey && watcher) return;

  await watcher?.close();
  watcher = null;
  watcherKey = nextWatcherKey;
  contentSignature = null;
  resetWorkspaceMarkdownCaches();

  const configPath = getZendocsConfigPath();
  const usePolling = isRunningInDocker();
  const nextWatcher = chokidar.watch(
    [path.join(workspaceRoot, "**/*.md"), configPath],
    {
      ignored: (filePath) => {
        if (path.resolve(filePath) === configPath) return false;
        return shouldIgnoreWatchPath(config, filePath);
      },
      ignoreInitial: true,
      interval: 500,
      usePolling,
    },
  );

  const emitMarkdownEvent = (event: ContentEventType, filePath: string) => {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(filePath);

    if (shouldSkipContentEvent(config, absolutePath)) return;

    contentSignature = null;
    resetWorkspaceMarkdownCaches();
    emitContentEvent({
      event,
      path: path.relative(workspaceRoot, absolutePath).split(path.sep).join("/"),
    });
  };

  const emitConfigEvent = () => {
    contentSignature = null;
    resetWorkspaceMarkdownCaches();
    watcherStartPromise = configureContentWatcher().finally(() => {
      watcherStartPromise = null;
    });
    emitContentEvent({ event: "config", path: "config.ts" });
  };

  nextWatcher.on("add", (filePath) => {
    if (path.resolve(filePath) === configPath) {
      emitConfigEvent();
      return;
    }

    emitMarkdownEvent("add", filePath);
  });
  nextWatcher.on("change", (filePath) => {
    if (path.resolve(filePath) === configPath) {
      emitConfigEvent();
      return;
    }

    emitMarkdownEvent("change", filePath);
  });
  nextWatcher.on("unlink", (filePath) => {
    if (path.resolve(filePath) === configPath) {
      emitConfigEvent();
      return;
    }

    emitMarkdownEvent("unlink", filePath);
  });

  watcher = nextWatcher;
}

async function startContentWatcher() {
  if (!watcherStartPromise) {
    watcherStartPromise = configureContentWatcher().finally(() => {
      watcherStartPromise = null;
    });
  }

  await watcherStartPromise;
}

export function subscribeToContentEvents(listener: ContentEventListener) {
  void startContentWatcher();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export async function getContentVersion() {
  await startContentWatcher();

  contentSignature ??= await createContentSignature();

  return contentSignature;
}
