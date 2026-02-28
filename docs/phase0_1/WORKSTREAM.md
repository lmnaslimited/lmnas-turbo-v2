# Phase 0.1 Workstream Control Panel

Keep this file open while running RR-flow work.

## Active items

| ID | Title | Owner | Status | Links |
| --- | --- | --- | --- | --- |
| 001 | import-pipeline-fidelity |  | Tasks | `INT-001` `SPEC-001` `TASK-001` `PROOF-001` `ADR-001` |

## Next 3 actions

- [ ] Run `pnpm phase0:guard -- --id 001` and keep it passing as artifacts evolve.
- [ ] Assign an owner and begin implementation strictly from `docs/phase0_1/tasks/TASK-001-import-pipeline-fidelity.md`.
- [ ] Update `docs/phase0_1/proof/PROOF-001-import-pipeline-fidelity.md` with evidence after implementation.

## Decision log

- RR-001 adopts strict->snapshot fallback with deterministic sanitizer, scoped CSS, safelist, theme debt reporting, and fidelity diff gate (see `docs/adr/ADR-001-import-pipeline-fidelity.md`).
