# Zendocs Handoff

## Goal

Build a local documentation reader named Zendocs that uses the Fumadocs UI theme as closely as possible, renders Markdown files from `/Users/ben/Documents/workspace/`, and preserves the workspace folder structure in the left navigation.

The app should feel like the Fumadocs docs site rather than a custom-designed reader.

## Current Progress

- The project lives at `/Users/ben/Documents/workspace/project/zendocs`.
- The package/app name is now `zendocs`.
- The visible site title/root label is `Zendocs`.
- The documentation source directory is fixed at `/Users/ben/Documents/workspace/`.
- Navigation scans Markdown files recursively and filters out these Markdown names case-insensitively:
  - `readme*`
  - `license` / `licence`
  - `changelog`
  - `contribution` / `contributing`
  - `thanks`
- Large Markdown files over 1 MB are skipped.
- Common generated/dependency folders are skipped, including `node_modules`, `.git`, `dist`, `build`, `.vite`, `.tanstack`, etc.
- Markdown rendering uses `marked` plus Fumadocs table-of-contents generation.
- Code blocks use `fumadocs-core/highlight` and render with Fumadocs/Shiki-style markup.
- The page uses Fumadocs components:
  - `DocsLayout`
  - `DocsPage`
  - `DocsBody`
  - `DocsTitle`
- The right-side table of contents uses Fumadocs `clerk` style.
- Page bottom now shows the file's last modified time through Fumadocs `lastUpdate`.
- Chinese UI text for last update is set to `最后更新于`.
- The app uses `portless` for local serving.
- Markdown pages no longer render an extra page-title derived from the file name above the document body. The first Markdown heading is now the visible document title.
- Body links use the Fumadocs-style warm orange underline, and link hover/focus plus text selection in the document body are kept in the same warm orange family rather than the browser default blue.

Key files:

- `/Users/ben/Documents/workspace/project/zendocs/package.json`
- `/Users/ben/Documents/workspace/project/zendocs/src/lib/workspace-markdown.ts`
- `/Users/ben/Documents/workspace/project/zendocs/src/routes/$lang.tsx`
- `/Users/ben/Documents/workspace/project/zendocs/src/routes/$lang/$.tsx`
- `/Users/ben/Documents/workspace/project/zendocs/src/routes/__root.tsx`
- `/Users/ben/Documents/workspace/project/zendocs/src/lib/layout.shared.tsx`
- `/Users/ben/Documents/workspace/project/zendocs/src/styles/fumadocs-overrides.css`

## What Worked

- Using Fumadocs UI directly and adding only narrow CSS overrides worked best.
- Keeping Markdown traversal in `src/lib/workspace-markdown.ts` made the app easy to reason about.
- `DocsPage lastUpdate={page.lastUpdate}` correctly adds the Fumadocs bottom "last updated" area.
- `stat(absolutePath).mtime.toISOString()` is enough for page update dates.
- The active sidebar state needed a stronger warm orange treatment in `src/styles/fumadocs-overrides.css`.
- The right TOC color needed explicit overrides for Fumadocs generated classes.
- The TOC active marker was successfully changed to a small filled diamond with CSS:
  - `#nd-toc div.bg-fd-primary`
  - `width: 6px`
  - `height: 6px`
  - `border-radius: 1px`
  - `transform: rotate(45deg)`
- Code highlighting works through `highlightHast` from `fumadocs-core/highlight` and `hast-util-to-html`.
- Removing `<DocsTitle>{page.title}</DocsTitle>` from `src/routes/$lang/$.tsx` fixed the duplicated file-name title on document pages.
- Link styling is best kept in `src/styles/fumadocs-overrides.css` with targeted `.prose a` rules. The blue state seen after right-clicking/selecting link text was the browser text selection color, fixed with `.prose ::selection`.
- `portless` can serve the app at:
  - `http://zendocs.localhost:1355/`
- During local validation, `bun run dev:app` served the app at:
  - `http://127.0.0.1:3140/`
- Validation commands that passed:
  - `bunx tsc --noEmit`
  - `bun run build`

## What Didn't Work

- Adding `font-weight: 600` to inline code was rejected because the current font does not have a real semibold weight; `600` rendered like bold and looked too heavy. That CSS was removed.
- The orange underline seen in Fumadocs is for links, not ordinary inline code. Do not add it to every inline code element.
- Trying to run `portless` inside the sandbox failed because it writes to `/Users/ben/.portless/proxy.log`; it needs elevated execution in this environment.
- `portless` with default HTTPS tried to handle local certificate trust and was not smooth. The current setup intentionally uses HTTP with `PORTLESS_HTTPS=0`.
- `portless` registered `zendocs.localhost` once under PID `26413`. Later attempts to start another copy reported the name was already registered. Check for stale/running processes before restarting.
- The project now has a git repository initialized, but most files were still untracked at the time of this handoff.
- `bun run build` prints a Vite warning that Node.js `20.18.3` is below Vite's recommended `20.19+` or `22.12+`, but the build still succeeds.

## Next Steps

1. Verify the visual placement of the bottom "最后更新于" text in the browser, especially near the bottom of long documents.
2. If the dev server needs restarting, first check the existing portless route/process:
   - `PORTLESS_PORT=1355 PORTLESS_HTTPS=0 ./node_modules/.bin/portless list`
   - `ps -p 26413 -o pid,command`
3. Consider cleaning up the `package.json` scripts. Current scripts are:
   - `dev`: `PORTLESS_PORT=1355 PORTLESS_HTTPS=0 portless zendocs bun run dev:app --force`
   - `dev:app`: `vite --host 127.0.0.1 --port ${PORT:-3000}`
   - `start`: same as `dev`
   
   The trailing `--force` is currently passed to Vite, not necessarily to portless. It works, but it causes Vite to force dependency re-optimization. If changing this, test carefully because earlier command shapes did not always keep the route registered.
4. Add file-change watching for `/Users/ben/Documents/workspace/` if the user asks for live refresh. Likely approach:
   - Watch the workspace root from the dev server side.
   - On Markdown create/update/delete, invalidate navigation/page data or trigger Vite full reload.
   - Avoid watching ignored directories and very large trees blindly.
5. Keep following the user's visual preference: use Fumadocs UI defaults first, then small targeted overrides only when the rendered result clearly differs from Fumadocs.
6. If more visual tweaks are requested, inspect Fumadocs generated CSS and DOM before inventing custom styles.
