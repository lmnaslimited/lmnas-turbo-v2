# PROOF-001E - docs

## Linked Spec: SPEC-001E

## Linked Intake: INT-001

## Summary of changes

- Updated Phase 0 importer documentation to include explicit Phase 0.1 usage for:
  - plan/apply flow with import mode `auto`
  - fidelity gate execution before apply
  - theme-enabled plan and fidelity runs (`--theme` + `--themes`)
  - Playwright setup and capture outputs
- Added troubleshooting guidance for fidelity threshold failures, missing Playwright runtime, and theme fidelity mismatch.

## Evidence

- UI screenshots (if applicable):
  - N/A (documentation-only scope)
- Test output summary:
  - `pnpm phase0:guard -- --id 001E` ✅ (`Phase0 guard: PASS`)
- Links to key files:
  - `docs/phase0/README.md`
  - `docs/phase0/onboarding.md`
  - `docs/phase0/troubleshooting.md`
  - `docs/phase0_1/proof/PROOF-001E-docs.md`

## Acceptance Criteria verification

| AC item | Status (✅/❌) | Notes |
| --- | --- | --- |
| AC-008 | ✅ | Docs now cover deterministic import fidelity pipeline usage, guard-compatible operational flow, and Playwright-dependent capture behavior with failure handling. |

## Deviations / follow-ups

- None.

## Release notes snippet (1-3 bullets)

- Added Phase 0.1 docs for import mode `auto`, fidelity gate commands, and theme-enabled runs.
- Added Playwright setup/capture guidance with expected artifact outputs.
- Added troubleshooting entries for fidelity threshold failures and missing Playwright runtime.
