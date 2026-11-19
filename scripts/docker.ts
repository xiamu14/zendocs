import { stat } from "node:fs/promises";
import path from "node:path";
import config from "../config.ts";
import {
  choice,
  finish,
  integer,
  parseCommand,
  runCli,
  start,
} from "./shared/cli.ts";
import { run, tool } from "./shared/process.ts";
import { booleanValue, selectValue, textValue } from "./shared/prompts.ts";

const DOCKER_ACTIONS = ["up", "down", "reload", "logs", "config"] as const;
type DockerAction = (typeof DOCKER_ACTIONS)[number];

async function resolveReadDirectory(): Promise<string> {
  const readDirectory = config.readDirectory;
  if (typeof readDirectory !== "string" || readDirectory.length === 0) {
    throw new Error("config.ts must set readDirectory to a non-empty string.");
  }

  const resolved = path.resolve(readDirectory);
  let info;
  try {
    info = await stat(resolved);
  } catch {
    throw new Error(`config.ts readDirectory does not exist: ${resolved}`);
  }

  if (!info.isDirectory()) {
    throw new Error(`config.ts readDirectory is not a directory: ${resolved}`);
  }

  return resolved;
}

await runCli("docker", async () => {
  const args = parseCommand({
    name: "docker",
    positional: "[action]",
    description:
      "Docker 服务管理：支持 up（启动/重建）、down（停止）、reload（本地构建并热更新 dist）、logs（查看日志）、config（查看配置）。",
    options: {
      port: {
        type: "string",
        default: process.env.ZENDOCS_PORT ?? "3017",
        description: "宿主机映射端口，范围 1–65535；也可使用 ZENDOCS_PORT",
      },
      image: {
        type: "string",
        default: process.env.ZENDOCS_IMAGE ?? "zendocs:local",
        description: "Docker 镜像名称；也可使用 ZENDOCS_IMAGE",
      },
      "no-build": {
        type: "boolean",
        default: false,
        description: "仅在 up 时生效：跳过镜像重建直接启动",
      },
    },
    examples: [
      "bun run docker",
      "bun run docker up --port 8080",
      "bun run docker up --no-build",
      "bun run docker reload",
      "bun run docker logs",
      "bun run docker down",
      "bun run docker --interactive",
    ],
  });
  if (!args) {
    return;
  }

  if (args.positionals.length > 1) {
    throw new Error(`多余的参数: ${args.positionals.slice(1).join(" ")}`);
  }

  let rawAction = args.positionals[0];
  let port = String(args.values.port);
  let image = String(args.values.image);
  let noBuild = args.values["no-build"] === true;

  if (args.interactive) {
    if (!rawAction) {
      rawAction = await selectValue("选择 Docker 操作", DOCKER_ACTIONS, "up");
    }
    if (rawAction === "up") {
      if (!args.provided.has("port")) {
        port = await textValue("宿主机端口", port);
      }
      if (!args.provided.has("no-build")) {
        noBuild = await booleanValue("跳过镜像重建（--no-build）？", noBuild);
      }
    }
  }

  const action: DockerAction = choice(
    rawAction ?? "up",
    DOCKER_ACTIONS,
    "action",
  );
  const validatedPort = integer(port, "--port", 65_535);

  if (action === "reload") {
    start("Docker 热更新 · 构建 dist 并重启 zendocs 容器");
    await tool("vite", ["build"], { NODE_ENV: "production" });
    await run("docker", ["cp", "./dist/.", "zendocs:/app/dist/"]);
    await run("docker", ["restart", "zendocs"]);
    finish("zendocs 容器已更新并重启");
    return;
  }

  const resolvedReadDirectory = await resolveReadDirectory();
  const composeEnv: NodeJS.ProcessEnv = {
    ZENDOCS_IMAGE: image,
    ZENDOCS_PORT: String(validatedPort),
    ZENDOCS_READ_DIRECTORY: resolvedReadDirectory,
  };

  start(`Docker · ${action}`);

  switch (action) {
    case "up": {
      const composeArgs = ["compose", "up", "-d", "--force-recreate"];
      if (!noBuild) {
        composeArgs.push("--build");
      }
      await run("docker", composeArgs, composeEnv);
      finish(`Docker 服务已启动 · http://localhost:${validatedPort}`);
      break;
    }
    case "down":
      await run("docker", ["compose", "down"], composeEnv);
      finish("Docker 服务已停止");
      break;
    case "logs":
      await run("docker", ["compose", "logs", "-f", "zendocs"], composeEnv);
      finish("日志查看已结束");
      break;
    case "config":
      await run("docker", ["compose", "config"], composeEnv);
      finish("Docker Compose 配置输出完成");
      break;
  }
});
