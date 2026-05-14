import type { ZendocsConfig } from "./src/lib/zendocs-config";

const config = {
  // Directory to scan for Markdown files.
  readDirectory: "/Users/ben/Documents/workspace",

  // Local editor launched by the Open button on a document page.
  // If args do not include {file}, Zendocs appends the current Markdown file path.
  // url is used by Docker/browser runtime to open the editor on the host.
  editor: {
    command: "open",
    args: ["-a", "Zed"],
    url: "zed://file/{file}",
  },

  // Files are filtered after confirming the file extension is .md.
  // Each rule is tested against both the file name and the relative path.
  filterFiles: [
    "README",
    /draft/i,
    { type: "glob", pattern: "**/archive/*.md" },
    { type: "regex", pattern: "^notes/private-", flags: "i" },
    { type: "string", value: "temporary" },
  ],

  // Directory rules are tested against both the directory name and the
  // relative path from readDirectory.
  filterDirectories: [
    "node_modules",
    /(^|\/)\.cache$/i,
    { type: "glob", pattern: "**/fixtures/**" },
    { type: "regex", pattern: "(^|/)dist$", flags: "i" },
    { type: "string", value: "generated" },
  ],

  // Markdown files larger than this value are ignored.
  maxFileSizeBytes: 1024 * 1024,
} satisfies ZendocsConfig;

export default config;
