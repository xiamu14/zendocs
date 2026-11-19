import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { $, ProcessOutput } from "zx";

export const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

export class CommandFailure extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number, options?: ErrorOptions) {
    super(message, options);
    this.exitCode = exitCode;
  }
}

interface ProcessOptions {
  capture?: boolean;
  timeout?: number;
}

async function execute(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  options: ProcessOptions = {},
): Promise<ProcessOutput> {
  const child = $({
    cwd: projectRoot,
    env: { ...process.env, ...env },
    stdio: options.capture ? "pipe" : "inherit",
    quiet: true,
    nothrow: options.capture === true,
    timeout: options.timeout,
  })`${command} ${args}`;

  let interrupted: number | undefined;
  const interrupt = (signal: NodeJS.Signals, exitCode: number) => {
    interrupted = exitCode;
    void child.kill(signal).catch(() => undefined);
  };
  const onInterrupt = () => interrupt("SIGINT", 130);
  const onTerminate = () => interrupt("SIGTERM", 143);

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);

  try {
    const output = await child;
    if (interrupted) {
      throw new CommandFailure("操作已取消", interrupted);
    }
    return output;
  } catch (error) {
    if (error instanceof ProcessOutput) {
      throw new CommandFailure(
        interrupted ? "操作已取消" : `${command.split("/").at(-1)} 执行失败`,
        interrupted ??
          (error.exitCode && error.exitCode > 0 ? error.exitCode : 1),
        { cause: error },
      );
    }
    throw error;
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
  }
}

export async function run(
  command: string,
  args: string[] = [],
  env: NodeJS.ProcessEnv = {},
): Promise<void> {
  await execute(command, args, env);
}

export function probe(
  command: string,
  args: string[] = [],
  timeout = 10_000,
): Promise<ProcessOutput> {
  return execute(command, args, {}, { capture: true, timeout });
}

export function tool(
  name: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): Promise<void> {
  return run(join(projectRoot, "node_modules", ".bin", name), args, env);
}
