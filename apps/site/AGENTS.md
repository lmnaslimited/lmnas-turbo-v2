# Site App — Codex Orientation

This is the primary LMNAs AI Website application.

Follow root AGENTS.md first.

## Block Rendering Rules
- All page content must come from validated block JSON.
- Never hardcode marketing copy inside components.
- Do not import block components directly into pages.
- Always render via block-registry + renderer.

## Data Rules
- Fetch CMS data in page layer only.
- Validate block data against Zod schemas before rendering.
- Do not fetch inside block components.

## UI Rules
- Tailwind only.
- No inline styles.
- Use layouts package for page shells.

## Conversion Governance
Hero and landing blocks must include:
- productMapping
- conversionConfig
- primaryCta

If missing → throw and fail render.

## Performance
- Use next/image.
- Avoid client components unless interaction required.