# INT-001 - import-pipeline-fidelity

## Problem / Job-to-be-done

The HTML-to-block import pipeline must preserve visual fidelity while producing deterministic, safe, schema-validated artifacts.
When strict semantic mapping is low-confidence, the importer must fall back to a snapshot representation that is still a valid allowlisted block and renders without raw HTML.

## User / ICP persona

- Platform engineer maintaining `packages/content-importer` and block allowlist governance.
- Content engineer onboarding pages from external URLs into Strapi.
- QA/Release owner gating imports on fidelity diffs before applying.

## Trigger (where in site/product)

- Running importer planning/onboarding from URL or local HTML: `pnpm content:onboard`, `pnpm content:plan`.
- Applying import plans to Strapi drafts/published content: `pnpm content:apply`.
- Any section where strict mapping cannot reach a defined confidence threshold.

## Desired outcome

- Deterministic pipeline from input DOM/CSS to a plan that is safe, diffable, and reproducible.
- Snapshot fallback that renders from a sanitized JSON tree (no raw HTML) with scoped styling and a deterministic Tailwind safelist.
- Theme-aware imports: consistent tokens, measurable theme debt, and fidelity diffs per theme.

## Non-goals

- No Router/Identity/Personalization work.
- No raw HTML rendering or `dangerouslySetInnerHTML`.
- No ad-hoc, non-deterministic class generation.
- No bypass of Policy A allowlist (manifest + registry).

## Constraints (Phase 0 rules, Policy A, Node 22, etc.)

- Must comply with `docs/architecture/LMNAs_Platform_Operating_Constitution_v2_1.md`.
- Policy A: new block type must be allowlisted in both manifest and runtime registry.
- Blocks remain pure UI: content provided via block JSON only.
- Node >= 22, cross-platform (mac/linux/windows).
- Deterministic outputs: stable ordering, stable hashing inputs, stable file writes.
- Input sanitization must remove executable content (scripts/handlers).

## Acceptance Criteria (observable bullets)

- [ ] AC-001 (TASK-0.1.1): `ImportedDomSnapshot` block exists with fields `domJson`, `classMap`, `stylesheetRef`, fixture JSON, schema parse test, render test, and is allowlisted (manifest + registry).
- [ ] AC-002 (TASK-0.1.2): DOM sanitizer produces a deterministic JSON tree with: no raw HTML, scripts removed, inline handlers removed, `<style>` tags removed from the input tree, relative URLs normalized, and stable output for identical inputs.
- [ ] AC-003 (TASK-0.1.3): CSS-to-Tailwind mapper converts a defined set of common CSS rules to Tailwind utilities; uses arbitrary utilities only when necessary; emits a deterministic `classMap`.
- [ ] AC-004 (TASK-0.1.4): Tailwind safelist generator writes a deterministic safelist file; repeated runs with same inputs produce byte-identical output; generator is integrated into the importer plan/apply flow.
- [ ] AC-005 (TASK-0.1.5): Scoped stylesheet generator emits `@layer components` CSS, scoped under a strict `#imported-<hash>` wrapper, and stores reference as `stylesheetRef` used by the snapshot block.
- [ ] AC-006 (TASK-0.1.6): Import mode `auto` is defined: strict mapping is attempted first, then snapshot fallback is selected based on a defined confidence score per section; fallback always yields a valid allowlisted block.
- [ ] AC-007 (TASK-0.1.7): Fidelity runner is specified: Playwright screenshots + diff gate before apply; a defined numeric diff threshold blocks apply; `--force` override is specified.
- [ ] AC-008 (TASK-0.1.8): Documentation updates are specified for README/AGENTS/import system docs to reflect snapshot fallback, determinism, and guard usage.
- [ ] AC-009 (TASK-0.1.9): Theme token registry + mapping utilities are specified with a token catalog (colors/typography/radius/shadow), nearest-color match with explicit thresholds, and a `ThemeDebtReport` schema/output.
- [ ] AC-010 (TASK-0.1.10): Import CLI supports `--theme`; theme is stored in the plan and applied via `themeScopeClass` at page root or snapshot wrapper.
- [ ] AC-011 (TASK-0.1.11): Fidelity runner supports themes: screenshots per theme and metrics per theme run are specified.

## Telemetry / Analytics (what will be tracked; allow "TBD")

- `import_mode_selected` with fields: `id`, `slug`, `mode` (`strict|snapshot`), `confidence`, `theme`.
- `import_snapshot_used` with fields: `id`, `slug`, `sectionKey`, `hash`.
- `import_fidelity_diff` with fields: `id`, `slug`, `theme`, `diffRatio`, `threshold`, `forced`.
- `import_theme_debt` with fields: `id`, `slug`, `theme`, `unknownTokens`, `nearestMatches`, `hardFailures`.

## Links (Spec/Tasks/Proof placeholders)

- Spec: SPEC-001
- Tasks: TASK-001
- Proof: PROOF-001

## Subsystem RR units

- 001A Snapshot + Sanitizer:
  - Spec: `docs/phase0_1/specs/SPEC-001A-snapshot-sanitizer.md`
  - Tasks: `docs/phase0_1/tasks/TASK-001A-snapshot-sanitizer.md`
  - Proof: `docs/phase0_1/proof/PROOF-001A-snapshot-sanitizer.md`
- 001B CSS System:
  - Spec: `docs/phase0_1/specs/SPEC-001B-css-system.md`
  - Tasks: `docs/phase0_1/tasks/TASK-001B-css-system.md`
  - Proof: `docs/phase0_1/proof/PROOF-001B-css-system.md`
- 001C Import Mode + Fidelity:
  - Spec: `docs/phase0_1/specs/SPEC-001C-import-mode-fidelity.md`
  - Tasks: `docs/phase0_1/tasks/TASK-001C-import-mode-fidelity.md`
  - Proof: `docs/phase0_1/proof/PROOF-001C-import-mode-fidelity.md`
- 001D Theme System:
  - Spec: `docs/phase0_1/specs/SPEC-001D-theme-system.md`
  - Tasks: `docs/phase0_1/tasks/TASK-001D-theme-system.md`
  - Proof: `docs/phase0_1/proof/PROOF-001D-theme-system.md`
- 001E Documentation:
  - Spec: `docs/phase0_1/specs/SPEC-001E-docs.md`
  - Tasks: `docs/phase0_1/tasks/TASK-001E-docs.md`
  - Proof: `docs/phase0_1/proof/PROOF-001E-docs.md`
