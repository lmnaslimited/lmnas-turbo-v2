# TASK-001 - import-pipeline-fidelity

## Linked Spec: SPEC-001

## Preconditions checklist (spec exists, contracts ready)

- [ ] `INT-001` and `SPEC-001` exist in git and are linked.
- [ ] This task plan is the only implementation authority for Codex.
- [ ] Policy A expectations are understood (manifest + registry allowlist).
- [ ] `pnpm phase0:guard -- --id 001` passes before any coding begins.

## Subsystem task units

This RR is executed via subsystem task units. Codex implements only from the subsystem `TASK-001X` documents.

- 001A Snapshot + Sanitizer: `docs/phase0_1/tasks/TASK-001A-snapshot-sanitizer.md`
- 001B CSS System: `docs/phase0_1/tasks/TASK-001B-css-system.md`
- 001C Import Mode + Fidelity: `docs/phase0_1/tasks/TASK-001C-import-mode-fidelity.md`
- 001D Theme System: `docs/phase0_1/tasks/TASK-001D-theme-system.md`
- 001E Documentation: `docs/phase0_1/tasks/TASK-001E-docs.md`

## Commands to run (pnpm lint/typecheck/test or repo-equivalents)

- `pnpm phase0:guard -- --id 001`
- `pnpm contracts:gen`
- `pnpm contracts:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
