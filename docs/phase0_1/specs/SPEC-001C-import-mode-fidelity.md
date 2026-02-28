# SPEC-001C - import-mode-fidelity

## Linked Intake: INT-001

## Scope

- Define import mode `auto`:
  - strict -> snapshot fallback
  - confidence scoring per section
  - fallback remains valid block
- Define fidelity runner:
  - Playwright screenshots
  - diff gate before apply
  - `--force` override

## Non-goals

- No runtime feature implementation in this RR artifact set.

## Data Flow (inputs -> transforms -> outputs)

Input:
- Per-section feature extraction from importer mapping attempt
- Optional theme set for fidelity run

Transforms:
1. Confidence scoring per section:
   - compute confidence
   - select strict vs snapshot
2. Fidelity runner:
   - capture screenshots per theme
   - compute diff metrics
   - enforce threshold unless `--force`

Outputs:
- Mode selection (`strict|snapshot`) per section with confidence score.
- Fidelity report with per-theme screenshots and metrics.

## Confidence Scoring (explicit)

For each section `S`:

- `recognizedNodeRatio = recognizedNodes / totalNodes`
- `mappedStyleRatio = mappedStyleDeclarations / totalStyleDeclarations`
- `unsupportedSelectorPenalty = min(0.15, unsupportedSelectorCount * 0.01)`
- `inlineStylePenalty = min(0.15, strippedInlineStyleCount * 0.005)`

Score:
- `confidence = clamp01(0.60 * recognizedNodeRatio + 0.40 * mappedStyleRatio - unsupportedSelectorPenalty - inlineStylePenalty)`

Thresholds:
- `strict` accepted when `confidence >= 0.85`
- snapshot fallback when `confidence < 0.85`

## Fidelity Diff Gate (explicit)

Screenshots:
- Capture PNG at 1280x720 viewport.

Diff metric:
- `diffRatio = differingPixels / totalPixels`

Gate:
- Fail when `diffRatio > 0.005` (0.5% pixels differ) unless `--force` is provided.

## Files to Create/Modify

| Path | Change Type | Reason |
| --- | --- | --- |
| packages/content-importer/src/import/confidence.ts | create | Confidence scoring implementation |
| packages/content-importer/src/import/* | modify | Integrate auto mode selection into plan generation |
| packages/content-importer/src/fidelity/* | create | Playwright fidelity runner + report |
| packages/content-importer/src/cli.ts | modify | Add fidelity runner command + `--force` |

## Test Plan (unit/integration/e2e)

- Unit:
  - Confidence: exact formula and thresholds.
- E2E:
  - Playwright renders baseline and imported output and enforces diff gate.

## Rollout / Risk notes

- Fallback remains valid block: snapshot path must always produce allowlisted blocks.
- Diff gate must be enforced before apply unless explicitly forced.

