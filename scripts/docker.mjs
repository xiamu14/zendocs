import { stat } from "node:fs/promises";
import path from "node:path";
import config from "../config.ts";

const command = process.argv[2] ?? "up";
const readDirectory = config.readDirectory;

if (typeof readDirectory !== "string" || readDirectory.length === 0) {
  console.error("config.ts must set readDirectory to a non-empty string.");
  process.exit(1);
}

const resolvedReadDirectory = path.resolve(readDirectory);

try {
  const info = await stat(resolvedReadDirectory);
  if (!info.isDirectory()) {
    console.error(`config.ts readDirectory is not a directory: ${resolvedReadDirectory}`);
    process.exit(1);
  }
} catch {
  console.error(`config.ts readDirectory does not exist: ${resolvedReadDirectory}`);
  process.exit(1);
}

const env = {
  ...process.env,
  ZENDOCS_IMAGE: process.env.ZENDOCS_IMAGE ?? "zendocs:local",
  ZENDOCS_PORT: process.env.ZENDOCS_PORT ?? "3017",
  ZENDOCS_READ_DIRECTORY: resolvedReadDirectory,
};

async function run(cmd, args, options = {}) {
  const proc = Bun.spawn([cmd, ...args], {
    env: { ...env, ...options.env },
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0 && !options.allowFailure) {
    process.exit(exitCode);
  }

  return exitCode;
}

switch (command) {
  case "up":
    await run("docker", ["compose", "up", "-d", "--build", "--force-recreate"]);
    await run("portless", ["alias", "zendocs", env.ZENDOCS_PORT, "--force"], {
      env: {
        PORTLESS_HTTPS: "0",
        PORTLESS_LAN: "1",
        PORTLESS_PORT: "1355",
      },
    });
    break;

  case "alias":
    await run("portless", ["alias", "zendocs", env.ZENDOCS_PORT, "--force"], {
      env: {
        PORTLESS_HTTPS: "0",
        PORTLESS_LAN: "1",
        PORTLESS_PORT: "1355",
      },
    });
    break;

  case "down":
    await run("portless", ["alias", "--remove", "zendocs"], {
      allowFailure: true,
      env: {
        PORTLESS_HTTPS: "0",
        PORTLESS_LAN: "1",
        PORTLESS_PORT: "1355",
      },
    });
    await run("docker", ["compose", "down"]);
    break;

  case "logs":
    await run("docker", ["compose", "logs", "-f", "zendocs"]);
    break;

  case "config":
    await run("docker", ["compose", "config"]);
    break;

  default:
    console.error(`Unknown docker command: ${command}`);
    process.exit(1);
}
