# SPEC-001A - snapshot-sanitizer

## Linked Intake: INT-001

## Scope

- Create the `ImportedDomSnapshot` block (Policy A allowlisted) with required fields `domJson`, `classMap`, `stylesheetRef`.
- Define the DOM sanitizer that produces a deterministic JSON tree and performs mandatory stripping/normalization.

## Non-goals

- No raw HTML rendering, no executing imported scripts, no preserving inline handlers.
- No bypass of contract + manifest + registry allowlisting.

## UX Flow (happy path, edge cases)

### Fallback path: snapshot

1. Strict mapping attempt produces confidence below threshold.
2. Importer generates snapshot artifacts:
   - `domJson` (sanitized tree)
   - `classMap` (CSS-to-Tailwind mapping output)
   - `stylesheetRef` (scoped stylesheet reference)
3. Snapshot is stored as `ImportedDomSnapshot` block; the block remains valid under Policy A.

### Edge cases (must be handled deterministically)

- `<script>` nodes, inline `on*` handlers, and `javascript:` URLs.
- `<style>` tags and inline `style` attributes.
- Relative `href/src/srcset` with `base` tags and missing schemes.
- Duplicate/malformed class names and non-UTF8 characters.

## Data Flow (inputs -> transforms -> outputs)

Input:
- HTML document (from network or disk)
- `sourceUrl` used as normalization base

Transforms:
1. DOM sanitizer:
   - No raw HTML
   - Strip scripts
   - Strip inline handlers
   - Strip style tags
   - Normalize relative URLs
   - Deterministic output

Outputs:
- Allowlisted `ImportedDomSnapshot` block payload:
  - `domJson` (sanitized JSON tree)
  - `classMap` (provided by CSS system; referenced but not defined here)
  - `stylesheetRef` (provided by CSS system; referenced but not defined here)

## Interfaces / Contracts impacted

- New allowlisted block type:
  - Block: `ImportedDomSnapshot`
  - Required fields: `domJson`, `classMap`, `stylesheetRef`
  - Fixtures + tests required under `packages/blocks`
- Allowlist enforcement:
  - Contract entry in `packages/contracts/src/blocks/*.contract.ts`
  - Manifest regeneration via `pnpm contracts:gen`
  - Runtime registry mapping in `packages/block-registry/src/index.ts`

## Determinism Requirements (explicit)

- Sanitized JSON tree must be deterministic for identical inputs:
  - stable ordering of child nodes and attributes
  - stable key ordering for JSON emission (compatible with `stableStringify`)
- URL normalization:
  - resolve against `sourceUrl`
  - remove fragments (`#...`)
  - preserve query strings
  - lower-case scheme and host

## Files to Create/Modify

| Path | Change Type | Reason |
| --- | --- | --- |
| packages/blocks/ImportedDomSnapshot/schema.ts | create | Block schema/type for snapshot payload |
| packages/blocks/ImportedDomSnapshot/Component.tsx | create | Render sanitized JSON tree (no raw HTML) |
| packages/blocks/ImportedDomSnapshot/mock.ts | create | Fixture generator for tests |
| packages/blocks/ImportedDomSnapshot/defaults.json | create | Default fixture JSON |
| packages/blocks/ImportedDomSnapshot/Component.test.tsx | create | Schema parse + render snapshot/DOM test |
| packages/blocks/index.ts | modify | Export `ImportedDomSnapshot` types/schemas |
| packages/contracts/src/blocks/imported_dom_snapshot.contract.ts | create | Contract + governance metadata |
| packages/contracts/src/blocks/index.ts | modify | Export contract |
| packages/block-registry/src/index.ts | modify | Map block type -> schema + component |
| packages/block-registry/src/generated/blocks.manifest.ts | modify (generated) | Allowlist manifest update via `pnpm contracts:gen` |
| packages/content-importer/src/import/domSanitizer.ts | create | Sanitizer (strip scripts/handlers/styles) -> `domJson` |

## Test Plan (unit/integration/e2e)

- Unit:
  - DOM sanitizer: strips scripts/handlers/styles, normalizes URLs, stable output.
- Integration:
  - Importer emits `ImportedDomSnapshot` blocks when snapshot mode is selected.

## Rollout / Risk notes

- Sanitization must remove executable content (scripts/handlers) and must never output raw HTML.
- Snapshot block must remain allowlisted and renderable even when strict mapping fails.

