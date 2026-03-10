# TASK-004 - Studio Workflow Tightening Tasks

## Linked Spec: SPEC-004

## Preconditions checklist
- [x] Spec exists and is approved.
- [x] Test Model addendum finalized.

## Step-by-step tasks

| Step | Owner | File paths | Definition of done |
| --- | --- | --- | --- |
| 1 | Gemini | `docs/phase0_1/intake/*`, `docs/phase0_1/adr/*`, `docs/phase0_1/specs/*`, `docs/phase0_1/tests/*`, `docs/phase0_1/proof/*` | 004 RR documents formally committed defining workflow boundaries and testing behavior. |
| 2 | Gemini | `docs/phase0_1/tests/TEST_OWNERSHIP_AND_VALIDATION_ADDENDUM.md`, `AGENTS.md`, `README.md` | Ownership models rigidly documented in core governance artifacts preventing Claude self-validation. |
| 3 | Claude | `apps/site/app/platform/onboarding/*` | Refactored Studio UIs to merge Action Mapping into constraints. Browse block represents Default view. List UIs migrated to shared common reusable UI models. |
| 4 | Claude | `apps/site/app/platform/onboarding/*` | Fidelity overlaps, Theme swatch previews, and dark/light comparison toggles successfully constructed in UI block views. |
| 5 | Codex | `apps/site/app/api/platform/studio/themes*` | Duplicate upload handler configured throwing clear user-bound exceptions instead of React rendering key collisions. |
| 6 | Codex | `apps/site/app/api/platform/onboarding/analyze/route.ts` | HTML payload parsers strictly blocked from rendering Page slugs, constrained to pure atomic block generation. |
| 7 | Gemini | N/A | Execution of `TEST-004` Gap review output back into `PROOF-004`. |

## Commands to run
- `pnpm phase0:guard -- --id 004`

## Completion Checklist mapping to Acceptance Criteria
- [ ] AC mapped and assigned strictly per Agent capabilities.
