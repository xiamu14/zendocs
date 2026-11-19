import { finish, integer, parseCommand, runCli, start } from "./shared/cli.ts";
import { tool } from "./shared/process.ts";
import { booleanValue, textValue } from "./shared/prompts.ts";

await runCli("dev", async () => {
  const args = parseCommand({
    name: "dev",
    description: "本地开发：启动 Vite + TanStack Start 开发服务器。",
    options: {
      port: {
        type: "string",
        default: process.env.PORT ?? "3017",
        description: "HTTP 端口，范围 1–65535；也可使用 PORT",
      },
      host: {
        type: "boolean",
        default: false,
        description: "监听所有网络接口（0.0.0.0）",
      },
    },
    examples: [
      "bun run dev",
      "bun run dev --port 3000",
      "bun run dev --host",
      "bun run dev --interactive",
    ],
  });
  if (!args) {
    return;
  }

  let port = String(args.values.port);
  let host = args.values.host === true;

  if (args.interactive) {
    if (!args.provided.has("port")) {
      port = await textValue("HTTP 端口", port);
    }
    if (!args.provided.has("host")) {
      host = await booleanValue("监听所有网络接口（0.0.0.0）？", host);
    }
  }

  const validatedPort = integer(port, "--port", 65_535);
  const listenHost = host ? "0.0.0.0" : "127.0.0.1";

  start(`本地开发 · http://${listenHost}:${validatedPort}`);
  await tool(
    "vite",
    ["--host", listenHost, "--port", String(validatedPort), "--strictPort"],
    {
      NODE_ENV: "development",
      PORT: String(validatedPort),
    },
  );
  finish("开发服务已停止");
});
