import {
  type CANCEL_SYMBOL,
  cancel,
  confirm,
  isCancel,
  select,
  text,
} from "@clack/prompts";
import { CommandFailure } from "./process.ts";

async function answer<T>(
  result: Promise<T | typeof CANCEL_SYMBOL>,
): Promise<T> {
  const value = await result;
  if (isCancel(value)) {
    cancel("操作已取消");
    throw new CommandFailure("操作已取消", 130);
  }
  return value as T;
}

export async function selectValue<T extends string>(
  message: string,
  values: readonly T[],
  initialValue: T,
): Promise<T> {
  const selected = await answer<string>(
    select<string>({
      message,
      options: values.map((value) => ({ value, label: value })),
      initialValue,
    }),
  );
  return selected as T;
}

export function textValue(
  message: string,
  initialValue: string,
): Promise<string> {
  return answer<string>(
    text({
      message,
      initialValue,
      validate: (value) => (value?.trim() ? undefined : "请输入一个值"),
    }),
  );
}

export function booleanValue(
  message: string,
  initialValue: boolean,
): Promise<boolean> {
  return answer<boolean>(confirm({ message, initialValue }));
}
