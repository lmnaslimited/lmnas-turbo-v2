# PROOF-001B - css-system

## Linked Spec: SPEC-001B

## Linked Intake: INT-001

## Summary of changes

- Added a deterministic CSS-to-Tailwind mapping module that converts common declarations into utilities, falls back to arbitrary utilities only when needed, and emits stable `classMap` ordering.
- Added deterministic Tailwind safelist generation and file writing with stable header + sorted unique class lines.
- Added scoped stylesheet generation with strict `#imported-<sha256-hex-12>` wrapper and `@layer components` output.
- Integrated 001B flow into importer HTML/URL planning: generate sanitized snapshot `classMap`, compute `stylesheetRef`, and emit safelist/stylesheet artifacts during plan creation.

## Evidence

- UI screenshots (if applicable):
  - N/A (non-UI runtime/data-path changes validated by unit + integration tests).
- Test output summary:
  - `pnpm lint` ✅
  - `pnpm typecheck` ✅
  - `pnpm test` ✅
  - `pnpm phase0:guard -- --id 001B` ✅ (`Phase0 guard: PASS`)
- Links to key files:
  - `packages/content-importer/src/import/cssToTailwind.ts`
  - `packages/content-importer/src/import/tailwindSafelist.ts`
  - `packages/content-importer/src/import/scopedStylesheet.ts`
  - `packages/content-importer/src/index.ts`
  - `packages/content-importer/src/__tests__/inlineStyleAlignment.test.ts`
  - `packages/content-importer/src/__tests__/cssToTailwind.test.ts`
  - `packages/content-importer/src/__tests__/tailwindSafelist.test.ts`
  - `packages/content-importer/src/__tests__/scopedStylesheet.test.ts`
  - `packages/content-importer/src/__tests__/planSourcePriority.test.ts`

## Acceptance Criteria verification

| AC item | Status (✅/❌) | Notes |
| --- | --- | --- |
| AC-003 | ✅ | `cssToTailwind` maps common CSS rules to Tailwind utilities, uses arbitrary utilities for unmapped values, emits deterministic `classMap` keys/classes, and now includes integration-style validation that inline styles align to correct `domJson` paths after sanitizer removal of script/style/inline handlers. |
| AC-004 | ✅ | `tailwindSafelist` writes deterministic safelist file content (sorted + unique) and is integrated into plan flow via `createPlanFromHtml` artifact writing. Repeated runs produce byte-identical output (unit + integration test). |
| AC-005 | ✅ | `scopedStylesheet` emits `@layer components` CSS under strict `#imported-<hash>` wrapper, with hash based on deterministic input (`domJson + classMap + themeKey`) and stored `stylesheetRef` in snapshot block. |

## Deviations / follow-ups

- No deviations from `TASK-001B` scope.

## Release notes snippet (1-3 bullets)

- Added deterministic CSS-to-Tailwind mapper and `classMap` emitter for snapshot imports.
- Added deterministic Tailwind safelist file generation and integration into import plan flow.
- Added scoped stylesheet generator with strict hashed wrapper and stable stylesheet reference output.
