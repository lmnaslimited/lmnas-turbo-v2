# PROOF-001C - import-mode-fidelity

## Linked Spec: SPEC-001C

## Linked Intake: INT-001

## Summary of changes

- Implemented import mode `auto` confidence scoring integration in importer plan generation, including deterministic per-section decisions (`strict|snapshot`), score/metric storage, and summary counts under plan source metadata.
- Implemented fidelity gate core with explicit threshold enforcement (`diffRatio <= 0.005`), `--force` override semantics, deterministic metrics artifact writing, and apply-time gate enforcement for snapshot plans.
- Added CLI integration for 001C:
  - `content-importer fidelity` command with baseline/candidate capture flow and deterministic report persistence back into plan source metadata.
  - `content-importer apply` now supports `--force` for fidelity gate override and reports gate status in apply output.
- Added Playwright-backed capture adapter (runtime-loaded, no new dependency added) to produce screenshots and pixel diff ratio for fidelity gating when Playwright is available in the environment.
- Added 001C-focused tests for confidence formulas/thresholds, auto-mode plan metadata, fidelity gate behavior, and schema acceptance of new metadata.

## Evidence

- UI screenshots (if applicable):
  - N/A (validated through automated tests and deterministic artifact/report generation).
- Test output summary:
  - `pnpm lint` ✅
  - `pnpm typecheck` ✅
  - `pnpm test` ✅
  - `pnpm phase0:guard -- --id 001C` ✅ (`Phase0 guard: PASS`)
- Links to key files:
  - `packages/content-importer/src/import/confidence.ts`
  - `packages/content-importer/src/index.ts`
  - `packages/content-importer/src/fidelity/gate.ts`
  - `packages/content-importer/src/fidelity/playwrightCapture.ts`
  - `packages/content-importer/src/cli.ts`
  - `packages/content-importer/src/contracts/contentPlan.schema.ts`
  - `packages/content-importer/src/__tests__/confidence.test.ts`
  - `packages/content-importer/src/__tests__/importModeAuto.test.ts`
  - `packages/content-importer/src/__tests__/fidelityGate.test.ts`
  - `packages/content-importer/__tests__/planSchema.test.ts`

## Acceptance Criteria verification

| AC item | Status (✅/❌) | Notes |
| --- | --- | --- |
| AC-006 | ✅ | Import mode `auto` now computes confidence per section using the SPEC formula/threshold (`0.85`), records `{sectionKey, mode, confidence, metrics}` deterministically in plan source metadata, and preserves snapshot fallback validity via allowlisted `blocks.imported-dom-snapshot`. |
| AC-007 | ✅ | Fidelity runner gate implemented with per-theme run metrics, diff threshold `0.005`, deterministic report artifact output, and apply-time blocking when fidelity fails unless `--force` is passed. |

## Deviations / follow-ups

- Playwright browser automation is runtime-loaded; environments running `content-importer fidelity` must have `playwright` or `playwright-core` available. Unit tests validate gate logic and report determinism without requiring browser install.

## Release notes snippet (1-3 bullets)

- Added import mode `auto` confidence metadata with deterministic per-section strict/snapshot decisions.
- Added fidelity gate/report pipeline (`0.005` threshold, `--force` override) and apply-time enforcement for snapshot imports.
- Added CLI `fidelity` command and 001C test coverage for confidence scoring and gate behavior.
