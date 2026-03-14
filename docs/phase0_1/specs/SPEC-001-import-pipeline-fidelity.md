# SPEC-001 - import-pipeline-fidelity

## Linked Intake: INT-001

## Scope

Define a deterministic, safe import pipeline that can:

- Sanitize DOM into a JSON tree (no raw HTML) and normalize URLs deterministically.
- Map CSS to Tailwind utilities and emit a deterministic `classMap`.
- Generate deterministic Tailwind safelists and scoped stylesheets for snapshot rendering.
- Select import mode (`strict` vs snapshot fallback) using explicit confidence scoring.
- Run a fidelity runner with Playwright screenshots and a diff gate (with `--force` override).
- Support themes in plan generation and fidelity runs, including a `ThemeDebtReport`.

## Non-goals

- No runtime feature implementation in this RR artifact set.
- No direct HTML rendering, no executing imported scripts, no preserving inline handlers.
- No bypass of contract + manifest + registry allowlisting.

## UX Flow (happy path, edge cases)

### Happy path: strict mapping

1. Importer ingests HTML from `--url` or `--html` input.
2. For each section, strict block mapping is attempted.
3. Confidence score is computed for each section; strict mapping is accepted when it meets threshold.
4. Import plan is emitted with allowlisted blocks only.

### Fallback path: snapshot

1. Strict mapping attempt produces confidence below threshold.
2. Importer generates snapshot artifacts:
   - `domJson` (sanitized tree)
   - `classMap` (CSS-to-Tailwind mapping output)
   - `stylesheetRef` (scoped stylesheet reference)
   - safelist file output (deterministic)
3. Snapshot is stored as `ImportedDomSnapshot` block; the block remains valid under Policy A.

### Edge cases (must be handled deterministically)

- `<script>` nodes, inline `on*` handlers, and `javascript:` URLs.
- `<style>` tags and inline `style` attributes.
- Relative `href/src/srcset` with `base` tags and missing schemes.
- CSS rules with unsupported properties or complex selectors.
- Duplicate/malformed class names and non-UTF8 characters.

## Data Flow (inputs -> transforms -> outputs)

Input:
- HTML document (from network or disk)
- Optional external CSS references discovered in HTML
- Optional `--theme <themeKey>`

Transforms:
1. DOM sanitizer:
   - strips scripts, inline handlers, and style tags from the input tree
   - normalizes URLs
   - produces deterministic `domJson` using stable key ordering (compatible with `stableStringify`)
2. CSS-to-Tailwind mapper:
   - parses computed or extracted CSS rules for imported nodes
   - maps supported declarations to Tailwind utilities
   - emits deterministic `classMap`
3. Tailwind safelist generator:
   - derives the set of classes required for snapshot rendering
   - emits deterministic file output (sorted, stable header)
4. Scoped stylesheet generator:
   - emits `@layer components` CSS
   - prefixes all selectors under `#imported-<hash>`
   - stores as `stylesheetRef`
5. Import mode auto:
   - computes confidence per section
   - selects strict vs snapshot
6. Fidelity runner:
   - renders baseline vs imported snapshot/strict output
   - captures screenshots per theme
   - computes diff metrics and enforces threshold

Outputs:
- Import plan JSON with only allowlisted blocks
- Deterministic safelist file output
- Deterministic scoped stylesheet output
- Optional `ThemeDebtReport` JSON
- Fidelity run report with per-theme metrics

## Interfaces / Contracts impacted

- New allowlisted block type:
  - Block: `ImportedDomSnapshot`
  - Required fields: `domJson`, `classMap`, `stylesheetRef`
  - Fixtures + tests required under `packages/blocks`
- Allowlist enforcement:
  - Contract entry in `packages/contracts/src/blocks/*.contract.ts`
  - Manifest regeneration via `pnpm contracts:gen`
  - Runtime registry mapping in `packages/block-registry/src/index.ts`
- Import plan model:
  - `packages/content-importer/src/contracts/contentPlan.schema.ts` already treats blocks as records; no plan schema changes required.
  - Theme support requires a deterministic location for plan-level theme metadata (defined below).

### Theme metadata in plan (deterministic)

Plan must embed theme metadata under:
- `plan.source.theme`:
  - `themeKey`: string
  - `themeScopeClass`: string (`theme-<themeKey>`)

If `plan.source.theme` is missing, import is treated as `themeKey="default"` and `themeScopeClass="theme-default"`.

## Determinism Requirements (explicit)

- Hash inputs:
  - wrapper hash input is `stableStringify(domJson) + stableStringify(classMap) + stableStringify(themeKey)`
  - wrapper id is `imported-<sha256-hex-12>`
- URL normalization:
  - resolve against `sourceUrl` from plan creation
  - remove fragments (`#...`)
  - preserve query strings
  - lower-case scheme and host
- Output ordering:
  - all safelist classes sorted lexicographically
  - all emitted JSON uses stable key ordering

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
- Run per theme in the set: `[default] + themes passed via `--themes` (runner option)`.

Diff metric:
- `diffRatio = differingPixels / totalPixels`

Gate:
- Fail when `diffRatio > 0.005` (0.5% pixels differ) unless `--force` is provided.

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
| packages/content-importer/src/import/cssToTailwind.ts | create | Mapper -> `classMap` |
| packages/content-importer/src/import/tailwindSafelist.ts | create | Deterministic safelist emitter |
| packages/content-importer/src/import/scopedStylesheet.ts | create | Scoped `@layer components` stylesheet emitter |
| packages/content-importer/src/import/confidence.ts | create | Confidence scoring implementation |
| packages/content-importer/src/import/themeTokens.ts | create | Token registry + nearest-match utilities |
| packages/content-importer/src/import/themeDebtReport.ts | create | `ThemeDebtReport` writer |
| packages/content-importer/src/cli.ts | modify | Add `--theme` support and fidelity runner command |

## Test Plan (unit/integration/e2e)

- Unit:
  - DOM sanitizer: strips scripts/handlers/styles, normalizes URLs, stable output.
  - CSS mapper: mapping coverage for supported properties, deterministic `classMap`.
  - Safelist generator: stable output file, sorted lines, stable header.
  - Scoped stylesheet generator: correct wrapper prefixing, `@layer components` output.
  - Confidence: exact formula and thresholds.
  - Theme debt: nearest match thresholds and schema correctness.
- Integration:
  - Importer `plan` emits snapshot blocks when confidence below threshold.
  - Apply flow persists snapshot artifacts deterministically.
- E2E (fidelity runner):
  - Playwright renders baseline and imported output and enforces diff gate.
  - Theme runs generate per-theme screenshots and metrics.

## Rollout / Risk notes

- Safelist size growth must be bounded; report safelist line count per plan.
- CSS selector scoping must not leak styles outside wrapper.
- Snapshot fallback must remain allowlisted and renderable even when strict mapping fails.
- Theme debt thresholds must prevent silent regressions in strict mode.

## Links (Tasks/Proof placeholders)

- Tasks: TASK-001
- Proof: PROOF-001
