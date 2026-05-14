# UltraReader Design Context

## Reference Direction

The supplied Dribbble references establish the desired direction:

- A white documentation shell floating on a soft gray desktop-like background.
- Three-part reading composition: left navigation, central document, right "On this page" table of contents.
- Warm orange accent for selected states, breadcrumbs, active TOC markers, and small emphasis.
- High-contrast dark ink for headings, neutral gray body text, and restrained separators.
- Code examples should feel integrated and premium, with a single clear container and no nested borders.

## Color Strategy

Restrained product palette with one warm accent.

- App background: soft cool gray, not pure white.
- Reading surface: warm white.
- Sidebar surface: white or very light warm gray.
- Text: near-black neutral, never pure black.
- Muted text: medium neutral gray.
- Separator: low-contrast warm gray.
- Accent: warm orange, used for current file, active TOC item, badges, and small focus details.

Avoid blue as the dominant selection color. Blue may appear only for links if needed, and even then should be subdued.

## Typography

Use PingFang SC for Chinese-first UI and rendered text. Use SF Mono for code.

- Sidebar tree: compact, around 12-13 px.
- App chrome and path labels: 11-15 px.
- Rendered body: 16 px with comfortable line-height.
- Rendered H1: around 34-40 px depending on layout.
- Rendered H2: around 24-28 px.
- Do not let Quarkdown themes make headings extremely large or low contrast.

## Layout

- Overall app should use a 1:3 navigation-to-reading ratio.
- Left tree stays narrow and utilitarian.
- Main document column should be comfortable, not edge-to-edge.
- Right TOC should be visible when enough width exists and should not compete visually with the document.
- Avoid nested cards. Use one primary reading surface.

## Components

- Sidebar selected item: subtle warm orange tint or pale cream, with orange text or marker.
- Buttons: compact, rounded 6 px, native-feeling, with low-contrast backgrounds.
- Code block: one surface only, no double border. Light code blocks are preferred for this app.
- TOC: simple section list with warm orange active/accent treatment.

## Motion

Keep motion minimal. Use instant or very short state transitions only when they clarify selection or loading.
