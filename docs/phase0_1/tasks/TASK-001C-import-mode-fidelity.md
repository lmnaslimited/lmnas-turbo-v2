# TASK-001C - import-mode-fidelity

## Linked Spec: SPEC-001C

## Preconditions checklist (spec exists, contracts ready)

- [ ] `INT-001` exists in git.
- [ ] `SPEC-001C` exists and links `INT-001`.
- [ ] This task plan preserves canonical task definitions verbatim.

## Canonical Tasks (verbatim)

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

## Step-by-step tasks

| Step | File paths | Definition of done |
| --- | --- | --- |
| TASK-0.1.6 | `packages/content-importer/src/import/confidence.ts` (+ tests), integration into plan generation | Auto mode selects strict vs snapshot by explicit confidence per section; fallback yields valid allowlisted block; satisfies AC-006 |
| TASK-0.1.7 | `packages/content-importer/src/fidelity/*` (runner + report), CLI integration in `packages/content-importer/src/cli.ts` | Playwright screenshots, diff gate `diffRatio <= 0.005`, `--force` override defined and implemented; satisfies AC-007 |

## Commands to run (pnpm lint/typecheck/test or repo-equivalents)

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Completion Checklist mapping to Acceptance Criteria

| Acceptance Criteria | Canonical Task | Completion evidence |
| --- | --- | --- |
| AC-006 | TASK-0.1.6 | Confidence thresholds drive mode selection |
| AC-007 | TASK-0.1.7 | Diff gate blocks apply without `--force` |

