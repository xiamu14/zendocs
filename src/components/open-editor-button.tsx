"use client";

import { useState } from "react";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { useCopyButton } from "fumadocs-ui/utils/use-copy-button";
import { Check, Copy, Pencil, LoaderCircle } from "lucide-react";
import { openWorkspaceMarkdownInEditor } from "@/lib/workspace-markdown";

type MarkdownPageActionsProps = {
  markdown: string;
  pagePath: string;
};

const actionButtonClass = buttonVariants({
  color: "secondary",
  size: "sm",
  className: "zd-page-action-button",
});

export function MarkdownPageActions({
  markdown,
  pagePath,
}: MarkdownPageActionsProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, onCopy] = useCopyButton(async () => {
    await navigator.clipboard.writeText(markdown);
  });

  async function handleOpen() {
    setIsOpening(true);
    setError(null);

    try {
      const result = await openWorkspaceMarkdownInEditor({
        data: { pagePath },
      });

      if (!result.ok) setError(result.message);
    } catch {
      setError("Could not open the configured editor.");
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <div className="not-prose zd-page-actions">
      <div className="zd-page-actions-row">
        <button type="button" onClick={onCopy} className={actionButtonClass}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          Copy Markdown
        </button>
        <button
          type="button"
          disabled={isOpening}
          onClick={handleOpen}
          className={actionButtonClass}
        >
          {isOpening ? (
            <LoaderCircle size={14} className="animate-spin" />
          ) : (
            <Pencil size={14} />
          )}
          Open
        </button>
      </div>
      {error ? <p className="zd-page-actions-error">{error}</p> : null}
    </div>
  );
}
