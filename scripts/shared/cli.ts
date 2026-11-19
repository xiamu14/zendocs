import { type ParseArgsOptionsConfig, parseArgs } from "node:util";
import { intro, log, outro } from "@clack/prompts";
import { CommandFailure } from "./process.ts";

export type CliOption = {
  description: string;
  short?: string;
} & (
  | { type: "string"; default?: string }
  | { type: "boolean"; default?: boolean }
);

interface CommandDefinition {
  description: string;
  examples: string[];
  name: string;
  options?: Record<string, CliOption>;
  positional?: string;
}

export function parseCommand(definition: CommandDefinition) {
  const options: Record<string, CliOption> = {
    ...definition.options,
    help: { type: "boolean", short: "h", description: "显示帮助并退出" },
    interactive: {
      type: "boolean",
      default: false,
      description: "交互选择参数",
    },
  };
  const parserOptions: ParseArgsOptionsConfig = Object.fromEntries(
    Object.entries(options).map(
      ([name, { description: _description, ...option }]) => [name, option],
    ),
  );
  const { values, positionals, tokens } = parseArgs({
    args: process.argv.slice(2),
    options: parserOptions,
    allowPositionals: Boolean(definition.positional),
    strict: true,
    tokens: true,
  });

  if (values.help) {
    console.log(
      `${definition.description}\n\n用法: bun run ${definition.name}${definition.positional ? ` ${definition.positional}` : ""} [选项]\n`,
    );
    console.log("选项:");
    for (const [name, option] of Object.entries(options)) {
      const flag = `${option.short ? `-${option.short}, ` : ""}--${name}${option.type === "string" ? " <值>" : ""}`;
      const defaultValue =
        option.default === undefined ? "" : `（默认: ${option.default}）`;
      console.log(`  ${flag.padEnd(28)} ${option.description}${defaultValue}`);
    }
    console.log(
      `\n示例:\n${definition.examples.map((example) => `  ${example}`).join("\n")}`,
    );
    return;
  }

  if (values.interactive && !(process.stdin.isTTY && process.stdout.isTTY)) {
    throw new Error("--interactive 需要交互终端；自动化环境请直接传入参数");
  }

  return {
    values,
    positionals,
    provided: new Set(
      tokens
        .filter((token) => token.kind === "option")
        .map((token) => token.name),
    ),
    interactive: values.interactive === true,
  };
}

const POSITIVE_INTEGER_REGEX = /^[1-9]\d*$/u;

export function integer(
  value: unknown,
  name: string,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (typeof value !== "string" || !POSITIVE_INTEGER_REGEX.test(value)) {
    throw new Error(`${name} 必须是正整数`);
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result > max) {
    throw new Error(`${name} 必须在 1 到 ${max} 之间`);
  }
  return result;
}

export function choice<T extends string>(
  value: unknown,
  options: readonly T[],
  name: string,
): T {
  const result = options.find((option) => option === value);
  if (!result) {
    throw new Error(`${name} 必须是 ${options.join(" / ")}`);
  }
  return result;
}

export async function runCli(
  name: string,
  action: () => Promise<void>,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`${message}\n使用 bun run ${name} --help 查看用法`);
    process.exitCode = error instanceof CommandFailure ? error.exitCode : 1;
  }
}

export function start(message: string): void {
  intro(message);
}

export function finish(message: string): void {
  outro(message);
}
