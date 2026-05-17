import { useEffect } from "react";

type MermaidRendererProps = {
  version: string;
};

export function MermaidRenderer({ version }: MermaidRendererProps) {
  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let rendering = false;
    let shouldRenderAgain = false;

    function scheduleRender() {
      if (frame !== 0) return;

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        void renderMermaid();
      });
    }

    async function renderMermaid() {
      if (rendering) {
        shouldRenderAgain = true;
        return;
      }

      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(".zd-mermaid"),
      ).filter((node) => !node.querySelector("svg"));

      if (nodes.length === 0 || disposed) return;

      rendering = true;

      const { default: mermaid } = await import("mermaid");
      if (disposed) return;

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: document.documentElement.classList.contains("dark")
          ? "dark"
          : "default",
      });

      for (const node of nodes) {
        const source = node.dataset.mermaidSource;
        if (!source) continue;

        node.textContent = source;
        node.classList.add("mermaid");
        node.removeAttribute("data-processed");
      }

      try {
        await mermaid.run({ nodes });
      } catch (error) {
        console.error("Failed to render Mermaid diagram", error);
      } finally {
        rendering = false;

        if (shouldRenderAgain && !disposed) {
          shouldRenderAgain = false;
          scheduleRender();
        }
      }
    }

    const observer = new MutationObserver(scheduleRender);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    scheduleRender();

    return () => {
      disposed = true;
      observer.disconnect();

      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [version]);

  return null;
}
