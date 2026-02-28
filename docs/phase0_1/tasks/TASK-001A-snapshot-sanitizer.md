# TASK-001A - snapshot-sanitizer

## Linked Spec: SPEC-001A

## Preconditions checklist (spec exists, contracts ready)

- [ ] `INT-001` exists in git.
- [ ] `SPEC-001A` exists and links `INT-001`.
- [ ] This task plan preserves canonical task definitions verbatim.
- [ ] Policy A expectations are understood (manifest + registry allowlist).

## Canonical Tasks (verbatim)

TASK-0.1.1
Create ImportedDomSnapshot block:
- domJson
- classMap
- stylesheetRef
- fixtures
- render tests
- allowlisted in manifest + registry

TASK-0.1.2
DOM sanitizer -> JSON tree:
- No raw HTML
- Strip scripts
- Strip inline handlers
- Strip style tags
- Normalize relative URLs
- Deterministic output

## Step-by-step tasks

| Step | File paths | Definition of done |
| --- | --- | --- |
| TASK-0.1.1 | `packages/blocks/ImportedDomSnapshot/*`, `packages/block-registry/src/index.ts`, `packages/contracts/src/blocks/*`, `packages/block-registry/src/generated/blocks.manifest.ts` | Block exists with schema/type, fixtures, render tests; allowlisted in manifest + registry; satisfies AC-001 |
| TASK-0.1.2 | `packages/content-importer/src/import/domSanitizer.ts` (+ tests) | Sanitizer outputs deterministic `domJson`, strips scripts/handlers/styles, normalizes URLs; satisfies AC-002 |

## Commands to run (pnpm lint/typecheck/test or repo-equivalents)

- `pnpm contracts:gen`
- `pnpm contracts:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Completion Checklist mapping to Acceptance Criteria

| Acceptance Criteria | Canonical Task | Completion evidence |
| --- | --- | --- |
| AC-001 | TASK-0.1.1 | Block tests pass; manifest + registry include block |
| AC-002 | TASK-0.1.2 | Unit tests validate stripping + determinism |

