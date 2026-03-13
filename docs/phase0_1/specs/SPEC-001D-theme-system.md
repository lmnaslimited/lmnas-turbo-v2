# SPEC-001D - theme-system

## Linked Intake: INT-001

## Scope

- Theme token registry + mapping utilities:
  - Token catalog: colors, typography, radius, shadow
  - Nearest color match with thresholds
  - Output ThemeDebtReport
- Import CLI `--theme` support:
  - store theme in plan
  - apply `themeScopeClass` on page root or snapshot wrapper
- Fidelity runner theme support:
  - screenshot per theme
  - metrics per theme run

## Non-goals

- No runtime feature implementation in this RR artifact set.

## Theme metadata in plan (deterministic)

Plan must embed theme metadata under:
- `plan.source.theme`:
  - `themeKey`: string
  - `themeScopeClass`: string (`theme-<themeKey>`)

If `plan.source.theme` is missing, import is treated as `themeKey="default"` and `themeScopeClass="theme-default"`.

## Theme Token Registry + ThemeDebtReport (explicit)

Token catalog keys:
- `colors`
- `typography`
- `radius`
- `shadow`

Nearest color match:
- Color distance uses CIEDE2000 in L*a*b* space.
- Accept match when `deltaE <= 5.0`.
- Soft match when `5.0 < deltaE <= 10.0` (counts as debt, still usable).
- Reject when `deltaE > 10.0` (hard failure for strict mode).

ThemeDebtReport schema (JSON):
- `schemaVersion`: `"theme-debt.v1"`
- `themeKey`: string
- `generatedAt`: ISO timestamp
- `unknownTokens`: array of `{ tokenType, tokenKey, rawValue }`
- `nearestMatches`: array of `{ tokenType, rawValue, matchedTokenKey, deltaE }`
- `hardFailures`: array of `{ tokenType, rawValue, reason }`
- `summary`: `{ unknownCount, softMatchCount, hardFailureCount }`

## Files to Create/Modify

| Path | Change Type | Reason |
| --- | --- | --- |
| packages/content-importer/src/import/themeTokens.ts | create | Token registry + nearest-match utilities |
| packages/content-importer/src/import/themeDebtReport.ts | create | `ThemeDebtReport` writer |
| packages/content-importer/src/cli.ts | modify | Add `--theme` support |
| packages/content-importer/src/index.ts | modify | Store theme metadata in plan deterministically |
| packages/content-importer/src/fidelity/* | modify | Screenshot per theme + metrics per theme run |

## Test Plan (unit/integration/e2e)

- Unit:
  - Theme debt: nearest match thresholds and schema correctness.
- E2E:
  - Theme runs generate per-theme screenshots and metrics.

## Rollout / Risk notes

- Theme debt thresholds must prevent silent regressions in strict mode.

