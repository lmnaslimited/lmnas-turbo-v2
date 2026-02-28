# ADR-001 - import-pipeline-fidelity

## Status

Proposed

## Context

The importer currently needs a deterministic, safe fallback when strict semantic mapping cannot preserve fidelity.
Imported content must not execute scripts or handlers and must not render raw HTML.
Policy A requires new block types to be allowlisted through contracts -> manifest + registry mapping.

## Decision

1. Add a snapshot fallback block `ImportedDomSnapshot` that renders from a sanitized DOM JSON tree (`domJson`) and never from raw HTML.
2. Split import into deterministic stages:
   - sanitize DOM -> `domJson`
   - map CSS -> Tailwind utilities -> `classMap`
   - generate deterministic Tailwind safelist
   - generate scoped stylesheet under `#imported-<hash>` -> `stylesheetRef`
3. Implement import mode `auto` using explicit confidence scoring per section:
   - strict when `confidence >= 0.85`
   - snapshot fallback otherwise
4. Gate apply using a fidelity runner:
   - Playwright screenshots
   - diff ratio threshold `<= 0.005`
   - `--force` override for controlled bypass
5. Add theme support:
   - plan stores theme metadata (`themeKey`, `themeScopeClass`)
   - theme token registry + nearest-match thresholds
   - `ThemeDebtReport` emitted for debt visibility

## Consequences

- Pros:
  - Imports always yield a renderable, allowlisted block even when strict mapping fails.
  - Deterministic artifacts enable reproducible diffs, review, and gating.
  - Theme debt becomes measurable and enforceable.
- Cons:
  - Additional complexity in importer code and test surface.
  - Safelist generation can grow large; must be bounded and reported.
  - Fidelity runner requires browser automation in CI/local workflows.

## Links

- Intake: `docs/phase0_1/intake/INT-001-import-pipeline-fidelity.md`
- Spec: `docs/phase0_1/specs/SPEC-001-import-pipeline-fidelity.md`
- Tasks: `docs/phase0_1/tasks/TASK-001-import-pipeline-fidelity.md`
