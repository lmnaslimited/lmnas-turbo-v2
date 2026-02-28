# TASK-001D - theme-system

## Linked Spec: SPEC-001D

## Preconditions checklist (spec exists, contracts ready)

- [ ] `INT-001` exists in git.
- [ ] `SPEC-001D` exists and links `INT-001`.
- [ ] This task plan preserves canonical task definitions verbatim.

## Canonical Tasks (verbatim)

TASK-0.1.9
Theme token registry + mapping utilities:
- Token catalog:
  colors
  typography
  radius
  shadow
- Nearest color match with thresholds
- Output ThemeDebtReport

TASK-0.1.10
Import CLI --theme support:
- Store theme in plan
- Apply themeScopeClass on page root or snapshot wrapper

TASK-0.1.11
Fidelity runner theme support:
- Screenshot per theme
- Metrics per theme run

## Step-by-step tasks

| Step | File paths | Definition of done |
| --- | --- | --- |
| TASK-0.1.9 | `packages/content-importer/src/import/themeTokens.ts`, `packages/content-importer/src/import/themeDebtReport.ts` (+ tests) | Token catalog exists; nearest color match thresholds enforced; `ThemeDebtReport` schema and output implemented; satisfies AC-009 |
| TASK-0.1.10 | `packages/content-importer/src/cli.ts`, plan writer in `packages/content-importer/src/index.ts` | `--theme` stored in plan under deterministic key and applied via `themeScopeClass`; satisfies AC-010 |
| TASK-0.1.11 | `packages/content-importer/src/fidelity/*` | Fidelity runner executes per theme and reports metrics per theme run; satisfies AC-011 |

## Commands to run (pnpm lint/typecheck/test or repo-equivalents)

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Completion Checklist mapping to Acceptance Criteria

| Acceptance Criteria | Canonical Task | Completion evidence |
| --- | --- | --- |
| AC-009 | TASK-0.1.9 | ThemeDebtReport emitted + validated |
| AC-010 | TASK-0.1.10 | Plan stores theme + scope class deterministically |
| AC-011 | TASK-0.1.11 | Runner outputs per-theme screenshots + metrics |

