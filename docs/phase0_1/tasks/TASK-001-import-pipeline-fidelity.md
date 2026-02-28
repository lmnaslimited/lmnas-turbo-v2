# TASK-001 - import-pipeline-fidelity

## Linked Spec: SPEC-001

## Preconditions checklist (spec exists, contracts ready)

- [ ] `INT-001` and `SPEC-001` exist in git and are linked.
- [ ] This task plan is the only implementation authority for Codex.
- [ ] Policy A expectations are understood (manifest + registry allowlist).
- [ ] `pnpm phase0:guard -- --id 001` passes before any coding begins.

## Canonical Tasks (verbatim)

TASK-0.1.1
Create ImportedDomSnapshot block:
- domJson
- classMap
- stylesheetRef
- fixtures
- render tests
- allowlisted in manifest + registry

TASK-0.1.2
DOM sanitizer -> JSON tree:
- No raw HTML
- Strip scripts
- Strip inline handlers
- Strip style tags
- Normalize relative URLs
- Deterministic output

TASK-0.1.3
CSS-to-Tailwind mapper:
- Convert common CSS rules
- Arbitrary utilities only when necessary
- Emit classMap

TASK-0.1.4
Tailwind safelist generator:
- Deterministic file output
- Integrated into import/apply flow

TASK-0.1.5
Scoped stylesheet generator:
- @layer components CSS
- Strict #imported-<hash> wrapper
- Store as stylesheetRef

TASK-0.1.6
Import mode auto:
- strict -> snapshot fallback
- Confidence scoring per section
- Fallback remains valid block

TASK-0.1.7
Fidelity runner:
- Playwright screenshots
- Diff gate before apply
- --force override

TASK-0.1.8
Documentation updates:
- README
- AGENTS
- Import system docs

TASK-0.1.9
Theme token registry + mapping utilities:
- Token catalog:
  colors
  typography
  radius
  shadow
- Nearest color match with thresholds
- Output ThemeDebtReport

TASK-0.1.10
Import CLI --theme support:
- Store theme in plan
- Apply themeScopeClass on page root or snapshot wrapper

TASK-0.1.11
Fidelity runner theme support:
- Screenshot per theme
- Metrics per theme run

## Step-by-step tasks

| Step | File paths | Definition of done |
| --- | --- | --- |
| TASK-0.1.1 | `packages/blocks/ImportedDomSnapshot/*`, `packages/block-registry/src/index.ts`, `packages/contracts/src/blocks/*`, `packages/block-registry/src/generated/blocks.manifest.ts` | Block exists with schema/type, fixtures, render tests; allowlisted in manifest + registry; satisfies AC-001 |
| TASK-0.1.2 | `packages/content-importer/src/import/domSanitizer.ts` (+ tests) | Sanitizer outputs deterministic `domJson`, strips scripts/handlers/styles, normalizes URLs; satisfies AC-002 |
| TASK-0.1.3 | `packages/content-importer/src/import/cssToTailwind.ts` (+ tests) | Mapper converts defined CSS rules to Tailwind utilities with deterministic `classMap`; satisfies AC-003 |
| TASK-0.1.4 | `packages/content-importer/src/import/tailwindSafelist.ts` (+ tests), integration into `packages/content-importer/src/index.ts` and/or apply flow | Safelist file output is deterministic and integrated into plan/apply; satisfies AC-004 |
| TASK-0.1.5 | `packages/content-importer/src/import/scopedStylesheet.ts` (+ tests) | Generator emits `@layer components` CSS scoped under `#imported-<hash>` and writes/stores deterministic `stylesheetRef`; satisfies AC-005 |
| TASK-0.1.6 | `packages/content-importer/src/import/confidence.ts` (+ tests), integration into plan generation | Auto mode selects strict vs snapshot by explicit confidence per section; fallback yields valid allowlisted block; satisfies AC-006 |
| TASK-0.1.7 | `packages/content-importer/src/fidelity/*` (runner + report), CLI integration in `packages/content-importer/src/cli.ts` | Playwright screenshots, diff gate `diffRatio <= 0.005`, `--force` override defined and implemented; satisfies AC-007 |
| TASK-0.1.8 | `docs/phase0/*`, `AGENTS.md`, importer docs | Docs updated to reflect fidelity pipeline, determinism rules, and RR-flow governance; satisfies AC-008 |
| TASK-0.1.9 | `packages/content-importer/src/import/themeTokens.ts`, `packages/content-importer/src/import/themeDebtReport.ts` (+ tests) | Token catalog exists; nearest color match thresholds enforced; `ThemeDebtReport` schema and output implemented; satisfies AC-009 |
| TASK-0.1.10 | `packages/content-importer/src/cli.ts`, plan writer in `packages/content-importer/src/index.ts` | `--theme` stored in plan under deterministic key and applied via `themeScopeClass`; satisfies AC-010 |
| TASK-0.1.11 | `packages/content-importer/src/fidelity/*` | Fidelity runner executes per theme and reports metrics per theme run; satisfies AC-011 |

## Commands to run (pnpm lint/typecheck/test or repo-equivalents)

- `pnpm phase0:guard -- --id 001`
- `pnpm contracts:gen`
- `pnpm contracts:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Completion Checklist mapping to Acceptance Criteria

| Acceptance Criteria | Canonical Task | Completion evidence |
| --- | --- | --- |
| AC-001 | TASK-0.1.1 | Block tests pass; manifest + registry include block |
| AC-002 | TASK-0.1.2 | Unit tests validate stripping + determinism |
| AC-003 | TASK-0.1.3 | Unit tests validate mapping + determinism |
| AC-004 | TASK-0.1.4 | Safelist file is byte-identical across runs |
| AC-005 | TASK-0.1.5 | Scoped CSS output matches wrapper rules |
| AC-006 | TASK-0.1.6 | Confidence thresholds drive mode selection |
| AC-007 | TASK-0.1.7 | Diff gate blocks apply without `--force` |
| AC-008 | TASK-0.1.8 | Docs updated and referenced in RR-flow |
| AC-009 | TASK-0.1.9 | ThemeDebtReport emitted + validated |
| AC-010 | TASK-0.1.10 | Plan stores theme + scope class deterministically |
| AC-011 | TASK-0.1.11 | Runner outputs per-theme screenshots + metrics |
