# LMNAs Phase 0.1 Master Architect Prompt

## Operating Mode

- Objective: produce deterministic Phase 0.1 architecture artifacts in git for a single feature id.
- Scope: documentation and governance artifacts only; no runtime implementation.
- Authority order:
1. `ARCHITECTURE.md`
2. `docs/architecture/LMNAs_Platform_Operating_Constitution_v2_1.md`
3. `AGENTS.md`
4. `docs/phase0_1/README.md`
- Rule of Build: if it is not in Intake, it does not get built.
- Rule of Code: Codex implements only from `TASK-<ID>`.
- Rule of Done: `PROOF-<ID>` is required before closure.

## ID Format

- Feature IDs support:
  - Numeric: `001`
  - Numeric + subsystem suffix: `001A`
- `idNorm` rules:
  - zero-pad numeric part to 3 digits
  - suffix is optional and uppercased
  - examples: `1 -> 001`, `1a -> 001A`, `INT-001b -> 001B`

## RR-flow Gates

1. Gate 0 Intake: define problem, persona, triggers, constraints, acceptance criteria.
2. Gate 1 Spec: define scope, flow, contracts, impacted files, test strategy.
3. Gate 2 Task Plan: define executable step-by-step implementation plan.
4. Gate 3 Proof: verify acceptance criteria with concrete evidence.

No gate skipping is allowed.

## Tool Semantics

- Scaffolding:
  - Command: `pnpm phase0:new -- --id <id> --title "<title>"`
  - Purpose: creates Intake/Spec/Tasks/Proof docs from canonical templates.
  - Behavior: creates missing directories and uses zero-padded ids.
- Guard:
  - Command: `pnpm phase0:guard -- --id <id>`
  - Purpose: validates RR artifact presence and linking consistency.
  - Pass condition: command exits with code `0`.
  - Fail condition: command exits with code `1`; artifacts must be fixed before implementation.

## Canonical Task Insertion

After drafting `SPEC-<ID>`, produce `TASK-<ID>` by inserting canonical tasks using this structure:

1. Step number
2. Exact file path(s)
3. Definition of done for each step
4. Validation command(s) for each step where applicable

Canonical task requirements:
- Every acceptance criterion from Intake is mapped to one or more task steps.
- All touched files are listed explicitly.
- Validation commands include repository checks (`pnpm lint`, `pnpm typecheck`, `pnpm test`) unless out of scope.

## Artifact Requirements

For each feature id `<ID>`, generate and maintain:

- `docs/phase0_1/intake/INT-<ID>-<short-title>.md`
- `docs/phase0_1/specs/SPEC-<ID>-<short-title>.md`
- `docs/phase0_1/tasks/TASK-<ID>-<short-title>.md`
- `docs/phase0_1/proof/PROOF-<ID>-<short-title>.md`
- `docs/phase0_1/adr/ADR-<ID>-<short-title>.md` (architectural decision record)

Mandatory link fields:
- Spec includes `Linked Intake: INT-<ID>`
- Tasks includes `Linked Spec: SPEC-<ID>`
- Proof includes `Linked Spec: SPEC-<ID>`
- ADR references related `INT-<ID>` and `SPEC-<ID>`

## Output Required

- Output files must use the full normalized ID (`<ID>`), including subsystem suffix when present.
- Example numeric ID:
  - `INT-001-import-pipeline-fidelity.md`
  - `SPEC-001-import-pipeline-fidelity.md`
  - `TASK-001-import-pipeline-fidelity.md`
  - `PROOF-001-import-pipeline-fidelity.md`
- Example subsystem ID:
  - `SPEC-001A-snapshot-sanitizer.md`
  - `TASK-001A-snapshot-sanitizer.md`
  - `PROOF-001A-snapshot-sanitizer.md`

## Validation Checklist

- [ ] Intake exists and includes observable acceptance criteria.
- [ ] Spec exists and links Intake.
- [ ] Tasks exists and links Spec.
- [ ] Proof exists and links Spec.
- [ ] ADR exists and captures decision, context, and consequences.
- [ ] `pnpm phase0:guard -- --id <ID>` passes.
- [ ] Artifacts remain compliant with Constitution and Phase 0 constraints.

## Output Format Rules

- Use concise, deterministic markdown.
- Use repo-relative file paths.
- Avoid conversational text and avoid implementation code.
- Do not rely on chat memory; update artifacts directly in files.
- Keep IDs consistent across all artifacts (`INT/SPEC/TASK/PROOF/ADR-<ID>`).
- End with a short status summary:
  - Created files
  - Updated files
  - Guard result
