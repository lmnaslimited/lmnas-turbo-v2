# Phase 0.1 Workstream Control Panel

Keep this file open while running RR-flow work.

## Active items

| ID | Title | Owner | Status | Links |
| --- | --- | --- | --- | --- |
| 001A | snapshot-sanitizer |  | Tasks | `INT-001` `SPEC-001A` `TASK-001A` `PROOF-001A` |
| 001B | css-system |  | Tasks | `INT-001` `SPEC-001B` `TASK-001B` `PROOF-001B` |
| 001C | import-mode-fidelity |  | Tasks | `INT-001` `SPEC-001C` `TASK-001C` `PROOF-001C` |
| 001D | theme-system |  | Tasks | `INT-001` `SPEC-001D` `TASK-001D` `PROOF-001D` |
| 001E | docs |  | Tasks | `INT-001` `SPEC-001E` `TASK-001E` `PROOF-001E` |

## Next 3 actions

- [ ] Run `pnpm phase0:guard -- --id 001` and keep it passing as artifacts evolve.
- [ ] Assign owners for 001A-001E and begin implementation strictly from each subsystem `TASK-001X` document.
- [ ] Update each subsystem `PROOF-001X` with evidence after implementation.

## Decision log

- RR-001 split into 5 subsystem RR units (001A-001E) for parallel execution while preserving traceability to `INT-001` and `ADR-001`.
