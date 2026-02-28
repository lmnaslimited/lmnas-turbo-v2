# Phase 0.1 Requirement -> Realize (RR-flow)

Phase 0.1 defines a git-native handoff between architecture work and coding work.
All implementation context must live in tracked docs, not chat history.

## Gate Flow

1. Gate 0 Intake
2. Gate 1 Spec
3. Gate 2 Task Plan
4. Gate 3 Proof

Progression rule: do not move to the next gate until the current gate doc exists and is linked.

## Folder Structure and Naming

- `docs/phase0_1/intake/INT-###-short-title.md`
- `docs/phase0_1/specs/SPEC-###-short-title.md`
- `docs/phase0_1/tasks/TASK-###-short-title.md`
- `docs/phase0_1/proof/PROOF-###-short-title.md`

Use the same numeric id across the full chain.

## Operating Rules

- Rule of Build: If it is not in Intake, it does not get built.
- Rule of Code: Codex codes only from the TASK document, not from chat.
- Rule of Done: A Proof document is required before marking work done.

## Linking Example

- `INT-012 -> SPEC-012 -> TASK-012 -> PROOF-012`

## How to use with GPT + Codex

1. GPT writes or updates Intake, Spec, and Tasks docs in git.
2. Codex implements from `TASK-###` and updates code/tests.
3. GPT reviews implementation against Spec and Acceptance Criteria.
4. Team publishes `PROOF-###` with evidence and verification.

## Architect Mode Enforcement

All Phase 0.1 architecture generation must begin by loading:
`docs/phase0_1/PHASE0_1_MASTER_PROMPT.md`

This ensures:
- Deterministic RR-flow
- Canonical task preservation
- Guard compatibility
- Constitution compliance

Example workflow:
1. Open `PHASE0_1_MASTER_PROMPT.md`
2. Insert Canonical Tasks
3. Generate artifacts
4. Run `pnpm phase0:guard`
5. Switch to Codex for execution

## Optional Helper Commands

- `pnpm phase0:new -- --id 012 --title "rr-flow-bootstrap"`
- `pnpm phase0:guard -- --id 012`
