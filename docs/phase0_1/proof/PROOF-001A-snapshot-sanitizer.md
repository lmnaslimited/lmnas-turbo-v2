# PROOF-001A - snapshot-sanitizer

## Linked Spec: SPEC-001A

## Linked Intake: INT-001

## Summary of changes

- Implemented `ImportedDomSnapshot` with required schema fields (`domJson`, `classMap`, `stylesheetRef`), fixture/default payloads, a renderer, and block tests.
- Added `imported_dom_snapshot` contract + registry allowlisting and regenerated contracts-sync outputs (manifest + Strapi component/type artifacts).
- Added deterministic DOM sanitizer (`sanitizeDomToJson`) and tests for stripping unsafe content, URL normalization, and repeatable output.

## Evidence

- Screenshot evidence:
  - Not used for acceptance. This proof closes through schema, render, and unit test execution only.
- Test output summary:
  - `pnpm contracts:gen` ✅
  - `pnpm contracts:check` ✅
  - `pnpm lint` ✅
  - `pnpm typecheck` ✅
  - `pnpm test` ✅
  - `pnpm phase0:guard -- --id 001A` ✅ (`Phase0 guard: PASS`)
- Links to key files:
  - `packages/blocks/ImportedDomSnapshot/schema.ts`
  - `packages/blocks/ImportedDomSnapshot/Component.tsx`
  - `packages/blocks/ImportedDomSnapshot/Component.test.tsx`
  - `packages/contracts/src/blocks/imported_dom_snapshot.contract.ts`
  - `packages/contracts/src/index.ts`
  - `packages/block-registry/src/index.ts`
  - `packages/block-registry/src/generated/blocks.manifest.ts`
  - `packages/content-importer/src/import/domSanitizer.ts`
  - `packages/content-importer/src/__tests__/domSanitizer.test.ts`

## Acceptance Criteria verification

| AC item | Status (✅/❌) | Notes |
| --- | --- | --- |
| AC-001 | ✅ | Imported block implemented with schema/type + fixtures + render tests; contract/manifest/registry include `imported_dom_snapshot`. |
| AC-002 | ✅ | Sanitizer removes scripts/style tags/inline handlers/inline styles, normalizes URLs, and returns deterministic output for identical input. |

## Deviations / follow-ups

- No deviations from `TASK-001A` scope.

## Release notes snippet (1-3 bullets)

- Added allowlisted `imported_dom_snapshot` block with schema, contract metadata, registry mapping, fixtures, and tests.
- Added deterministic DOM sanitizer that outputs safe JSON trees without raw HTML execution paths.
- Added sanitizer unit coverage for stripping rules, URL normalization, and deterministic behavior.
