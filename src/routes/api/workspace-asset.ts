import { createFileRoute } from "@tanstack/react-router";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { getWorkspaceAssetPath } from "@/lib/workspace-markdown.server";

const contentTypes: Record<string, string> = {
  ".apng": "image/apng",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export const Route = createFileRoute("/api/workspace-asset")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const relativePath = url.searchParams.get("path");

        if (!relativePath) {
          return new Response("Missing asset path.", { status: 400 });
        }

        const absolutePath = getWorkspaceAssetPath(relativePath);
        if (!absolutePath) {
          return new Response("Asset is outside the workspace.", {
            status: 403,
          });
        }

        try {
          const info = await stat(absolutePath);
          if (!info.isFile()) {
            return new Response("Asset is not a file.", { status: 404 });
          }

          const extension = path.extname(absolutePath).toLocaleLowerCase();
          const contentType = contentTypes[extension];

          if (!contentType) {
            return new Response("Asset type is not supported.", {
              status: 415,
            });
          }

          const body = await readFile(absolutePath);
          return new Response(body, {
            headers: {
              "Cache-Control": "public, max-age=60",
              "Content-Type": contentType,
            },
          });
        } catch {
          return new Response("Asset not found.", { status: 404 });
        }
      },
    },
  },
});
