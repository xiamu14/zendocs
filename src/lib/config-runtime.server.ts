import { Buffer } from "node:buffer";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ZendocsConfig } from "./zendocs-config";

type ConfigCache = {
  config: ZendocsConfig;
  fileKey: string;
  version: string;
};

type BunRuntime = {
  Transpiler?: new (options: { loader: "ts" }) => {
    transformSync(source: string): string;
  };
};

const configPath = path.resolve(process.cwd(), "config.ts");
let configCache: ConfigCache | null = null;

async function getConfigFileState() {
  const fileInfo = await stat(configPath);

  return {
    fileKey: `${fileInfo.mtimeMs}:${fileInfo.size}`,
    version: `${configPath}:${fileInfo.mtimeMs}:${fileInfo.size}`,
  };
}

function assertZendocsConfig(value: unknown): asserts value is ZendocsConfig {
  if (!value || typeof value !== "object") {
    throw new Error("config.ts must default export a Zendocs config object.");
  }

  const readDirectory = (value as ZendocsConfig).readDirectory;
  if (typeof readDirectory !== "string" || readDirectory.length === 0) {
    throw new Error("config.ts must set readDirectory to a non-empty string.");
  }
}

async function importConfigModule(fileKey: string) {
  const bun = (globalThis as { Bun?: BunRuntime }).Bun;

  if (bun?.Transpiler) {
    const source = await readFile(configPath, "utf8");
    const transpiler = new bun.Transpiler({ loader: "ts" });
    const javascript = transpiler.transformSync(source);
    const encoded = Buffer.from(
      `${javascript}\n//# sourceURL=zendocs-config-${fileKey}.mjs`,
    ).toString("base64");

    return import(`data:text/javascript;base64,${encoded}`) as Promise<{
      default: unknown;
    }>;
  }

  const configUrl = pathToFileURL(configPath);
  configUrl.searchParams.set("v", fileKey);

  return import(/* @vite-ignore */ configUrl.href) as Promise<{
    default: unknown;
  }>;
}

export function getZendocsConfigPath() {
  return configPath;
}

export async function getZendocsConfig() {
  const fileState = await getConfigFileState();

  if (configCache?.fileKey === fileState.fileKey) {
    return configCache.config;
  }

  const configModule = await importConfigModule(fileState.fileKey);
  assertZendocsConfig(configModule.default);

  configCache = {
    config: configModule.default,
    fileKey: fileState.fileKey,
    version: fileState.version,
  };

  return configCache.config;
}

export async function getZendocsConfigVersion() {
  const fileState = await getConfigFileState();

  if (configCache?.fileKey === fileState.fileKey) {
    return configCache.version;
  }

  await getZendocsConfig();
  return configCache?.version ?? fileState.version;
}
