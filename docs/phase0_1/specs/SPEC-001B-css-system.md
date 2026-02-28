# SPEC-001B - css-system

## Linked Intake: INT-001

## Scope

- Define the CSS-to-Tailwind mapper and deterministic `classMap` emission.
- Define deterministic Tailwind safelist generation integrated into the import/apply flow.
- Define scoped stylesheet generation:
  - `@layer components` CSS
  - strict `#imported-<hash>` wrapper
  - store as `stylesheetRef`

## Non-goals

- No raw HTML rendering, no executing imported scripts, no preserving inline handlers.
- No non-deterministic class generation.

## Data Flow (inputs -> transforms -> outputs)

Input:
- Sanitized DOM JSON tree (`domJson`) from sanitizer stage
- Extracted CSS declarations applicable to imported nodes

Transforms:
1. CSS-to-Tailwind mapper:
   - Convert common CSS rules
   - Arbitrary utilities only when necessary
   - Emit classMap
2. Tailwind safelist generator:
   - Deterministic file output
   - Integrated into import/apply flow
3. Scoped stylesheet generator:
   - @layer components CSS
   - Strict #imported-<hash> wrapper
   - Store as stylesheetRef

Outputs:
- `classMap` (deterministic)
- Tailwind safelist file output (deterministic)
- Scoped stylesheet output and `stylesheetRef`

## Interfaces / Contracts impacted

- Snapshot payload dependencies:
  - `ImportedDomSnapshot.classMap`
  - `ImportedDomSnapshot.stylesheetRef`

## Determinism Requirements (explicit)

- Output ordering:
  - all safelist classes sorted lexicographically
  - all emitted JSON uses stable key ordering
- Wrapper hash:
  - wrapper id is `imported-<sha256-hex-12>`
  - wrapper hash input is `stableStringify(domJson) + stableStringify(classMap) + stableStringify(themeKey)`

## Files to Create/Modify

| Path | Change Type | Reason |
| --- | --- | --- |
| packages/content-importer/src/import/cssToTailwind.ts | create | Mapper -> `classMap` |
| packages/content-importer/src/import/tailwindSafelist.ts | create | Deterministic safelist emitter |
| packages/content-importer/src/import/scopedStylesheet.ts | create | Scoped `@layer components` stylesheet emitter |
| packages/content-importer/src/index.ts | modify | Integrate safelist + stylesheet outputs into plan/apply flow |

## Test Plan (unit/integration/e2e)

- Unit:
  - CSS mapper: mapping coverage for supported properties, deterministic `classMap`.
  - Safelist generator: stable output file, sorted lines, stable header.
  - Scoped stylesheet generator: correct wrapper prefixing, `@layer components` output.
- Integration:
  - Snapshot plans include deterministic `classMap` + `stylesheetRef` and safelist outputs.

## Rollout / Risk notes

- Safelist size growth must be bounded; report safelist line count per plan.
- CSS selector scoping must not leak styles outside wrapper.

