# TASK-### - <short title>

## Linked Spec: SPEC-###

## Preconditions checklist (spec exists, contracts ready)

- [ ] Spec exists and is approved.
- [ ] Required contracts/schemas are ready.
- [ ] Dependencies and environment constraints are clear.

## Delivery Gates & Step-by-step tasks

*(Implementation map bounded by TEST_OWNERSHIP_AND_VALIDATION_ADDENDUM.md)*

| Gate | Step | Owner | File paths | Definition of done |
| --- | --- | --- | --- | --- |
| 1 | Arch | ChatGPT | Constitution | Product bounds defined |
| 2 | Req | Gemini | `docs/phase0_1/*` | Specs, Intake, Tasks drafted |
| 3/4 | Dev | Claude/Codex | `apps/*` | Feature integrated; unit/local E2E tests pass locally |
| 5 | Val | Gemini | Gap Report | Gap Report generated / Test Pack complete |
| 6 | Fix | Claude/Codex | `apps/*` | All gaps resolved and re-tested locally |
| 7 | Sign-Off | Gemini | PROOF | Zero critical/high gaps. Sign-off Recommended |

## Commands to run (pnpm lint/typecheck/test or repo-equivalents)

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Completion Checklist mapping to Acceptance Criteria

- [ ] AC-1 mapped and verified.
- [ ] AC-2 mapped and verified.
