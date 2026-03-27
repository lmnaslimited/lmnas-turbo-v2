# Blocks Package — Codex Orientation

This package defines block components.

## Non-Negotiables
- Every block must include:
  - Zod schema
  - Exported TS type
  - Fixture JSON
  - Schema test
  - Render test

- No data fetching.
- No business logic.
- No copy hardcoded.
- No direct analytics tracking.

## Naming Convention
- Folder per block
- schema.ts
- index.tsx
- index.test.tsx