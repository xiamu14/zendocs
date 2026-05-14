import type { ZendocsConfig } from "./src/lib/zendocs-config";

const config = {
  readDirectory: "/Users/ben/Documents/workspace",
  editor: {
    command: "open",
    args: ["-a", "Zed"],
    url: "zed://file/{file}",
  },
  filterFiles: [
    /^(readme(?:[._-].*)?|licen[cs]e|licence|changelog|contribut(?:ion|ing)|thanks)(?:[._-].*)?$/i,
    "token",
  ],
  filterDirectories: [
    ".cache",
    ".claude",
    ".codex",
    ".gradle",
    ".output",
    ".pnpm-store",
    ".tanstack",
    ".vite",
    ".vinxi",
    ".yarn",
    "DerivedData",
    "build",
    "coverage",
    "dist",
    "Library",
    "node_modules",
    "target",
    "z1",
    "src",
  ],
  maxFileSizeBytes: 1024 * 1024,
} satisfies ZendocsConfig;

export default config;
