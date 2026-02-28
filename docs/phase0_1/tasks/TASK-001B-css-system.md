# TASK-001B - css-system

## Linked Spec: SPEC-001B

## Preconditions checklist (spec exists, contracts ready)

- [ ] `INT-001` exists in git.
- [ ] `SPEC-001B` exists and links `INT-001`.
- [ ] This task plan preserves canonical task definitions verbatim.

## Canonical Tasks (verbatim)

TASK-0.1.3
CSS-to-Tailwind mapper:
- Convert common CSS rules
- Arbitrary utilities only when necessary
- Emit classMap

TASK-0.1.4
Tailwind safelist generator:
- Deterministic file output
- Integrated into import/apply flow

TASK-0.1.5
Scoped stylesheet generator:
- @layer components CSS
- Strict #imported-<hash> wrapper
- Store as stylesheetRef

## Step-by-step tasks

| Step | File paths | Definition of done |
| --- | --- | --- |
| TASK-0.1.3 | `packages/content-importer/src/import/cssToTailwind.ts` (+ tests) | Mapper converts defined CSS rules to Tailwind utilities with deterministic `classMap`; satisfies AC-003 |
| TASK-0.1.4 | `packages/content-importer/src/import/tailwindSafelist.ts` (+ tests), integration into `packages/content-importer/src/index.ts` and/or apply flow | Safelist file output is deterministic and integrated into plan/apply; satisfies AC-004 |
| TASK-0.1.5 | `packages/content-importer/src/import/scopedStylesheet.ts` (+ tests) | Generator emits `@layer components` CSS scoped under `#imported-<hash>` and writes/stores deterministic `stylesheetRef`; satisfies AC-005 |

## Commands to run (pnpm lint/typecheck/test or repo-equivalents)

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Completion Checklist mapping to Acceptance Criteria

| Acceptance Criteria | Canonical Task | Completion evidence |
| --- | --- | --- |
| AC-003 | TASK-0.1.3 | Unit tests validate mapping + determinism |
| AC-004 | TASK-0.1.4 | Safelist file is byte-identical across runs |
| AC-005 | TASK-0.1.5 | Scoped CSS output matches wrapper rules |

