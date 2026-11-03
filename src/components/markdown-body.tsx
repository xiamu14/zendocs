import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DocsBody } from "fumadocs-ui/page";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { useCopyButton } from "fumadocs-ui/utils/use-copy-button";
import { Check, Copy } from "lucide-react";

function CodeCopyButton({ code }: { code: string }) {
  const [error, setError] = useState(false);
  const [copied, onCopy] = useCopyButton(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setError(false);
    } catch {
      setError(true);
    }
  });

  return (
    <button
      type="button"
      aria-label={
        error ? "Copy failed. Retry copying code" : copied ? "Copied code" : "Copy code"
      }
      title={error ? "Could not copy code" : copied ? "Copied code" : "Copy code"}
      className={buttonVariants({ size: "icon-xs" })}
      onClick={onCopy}
    >
      {copied && !error ? <Check /> : <Copy />}
    </button>
  );
}

export function MarkdownBody({ html }: { html: string }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<HTMLElement[]>([]);
  // Keep innerHTML stable so rerenders preserve the portal buttons and Mermaid SVGs.
  const body = useMemo(
    () => <DocsBody ref={bodyRef} dangerouslySetInnerHTML={{ __html: html }} />,
    [html],
  );

  useEffect(() => {
    setSlots(
      Array.from(bodyRef.current?.querySelectorAll<HTMLElement>("[data-code-copy]") ?? []),
    );
  }, [html]);

  return (
    <>
      {body}
      {slots.map((slot, index) =>
        createPortal(
          <CodeCopyButton code={slot.dataset.codeCopy ?? ""} />,
          slot,
          String(index),
        ),
      )}
    </>
  );
}
