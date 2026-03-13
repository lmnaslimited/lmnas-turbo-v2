# PROOF-001D - theme-system

## Linked Spec: SPEC-001D

## Linked Intake: INT-001

## Summary of changes

- Implemented theme token registry and mapping utilities in `themeTokens.ts` with catalog keys (`colors`, `typography`, `radius`, `shadow`) and nearest-color matching using CIEDE2000 thresholds (`<=5` accept, `<=10` soft, `>10` hard failure).
- Implemented `ThemeDebtReport` generation and deterministic JSON writing in `themeDebtReport.ts`, including schema fields (`schemaVersion`, `themeKey`, `generatedAt`, `unknownTokens`, `nearestMatches`, `hardFailures`, `summary`).
- Added `--theme` handling in importer plan CLI (`cli.ts`) and deterministic plan persistence in `index.ts` under `source.theme` (`themeKey`, `themeScopeClass`), with theme scope class applied to snapshot class mapping.
- Added fidelity runner theme support in `fidelity/themeRunner.ts` with per-theme screenshot path generation and per-theme metric reporting.
- Updated content plan schema to support `source.theme` metadata and added tests for all 001D requirements.

## Evidence

- UI screenshots (if applicable):
  - N/A (001D scope implemented as importer/theme utilities and runner logic with automated tests).
- Test output summary:
  - `pnpm lint` ✅
  - `pnpm typecheck` ✅
  - `pnpm test` ✅
  - `pnpm phase0:guard -- --id 001D` ✅ (`Phase0 guard: PASS`)
- Links to key files:
  - `packages/content-importer/src/import/themeTokens.ts`
  - `packages/content-importer/src/import/themeDebtReport.ts`
  - `packages/content-importer/src/fidelity/themeRunner.ts`
  - `packages/content-importer/src/index.ts`
  - `packages/content-importer/src/cli.ts`
  - `packages/content-importer/src/contracts/contentPlan.schema.ts`
  - `packages/content-importer/src/__tests__/themeTokens.test.ts`
  - `packages/content-importer/src/__tests__/themeDebtReport.test.ts`
  - `packages/content-importer/src/__tests__/themePlanMetadata.test.ts`
  - `packages/content-importer/src/__tests__/themeRunner.test.ts`
  - `packages/content-importer/__tests__/planSchema.test.ts`

## Acceptance Criteria verification

| AC item | Status (✅/❌) | Notes |
| --- | --- | --- |
| AC-009 | ✅ | Theme token catalog + mapping utilities implemented with explicit thresholds and `ThemeDebtReport` output schema/writer; unit tests cover threshold classification and report summaries. |
| AC-010 | ✅ | CLI plan flow accepts `--theme`, stores deterministic `source.theme` (`themeKey`, `themeScopeClass`) and applies `themeScopeClass` into snapshot mapping path; integration tests verify custom/default theme behavior. |
| AC-011 | ✅ | Theme fidelity runner executes once per theme with deterministic screenshot paths and per-theme metrics; tests verify runs, thresholds, and summary metrics. |

## Deviations / follow-ups

- No deviations from `TASK-001D` scope.

## Release notes snippet (1-3 bullets)

- Added theme token registry + CIEDE2000 matching utilities and `ThemeDebtReport` generation.
- Added deterministic theme metadata in import plans and theme scope application for snapshot class mapping.
- Added per-theme fidelity runner outputs (screenshot path + per-theme metrics).
