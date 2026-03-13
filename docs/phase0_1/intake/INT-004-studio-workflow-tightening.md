# INT-004 - Studio Workflow Tightening

## Problem / Job-to-be-done
Implementation drift has been detected in the onboarding Studio where agents (`Claude`/`Codex`) behave ambiguously or exceed bounds (e.g., Action Mapping existing as a standalone workflow rather than properly constrained). The process needs to be completely tightened so implementation maps securely to RR artifacts and validators check gap compliance strictly against spec boundaries.

## User / ICP persona
- Requirements, Validation, and Test Governance Owner (Gemini)
- Implementers (Claude / Codex)

## Trigger (where in site/product)
Studio workflows: Theme, Block, Action, Shell, Page, and Widget onboarding.

## Desired outcome
Rigid alignment of implementation against 4 isolated workflows. Predictable test ownership mapped explicitly to the Gate 1-7 delivery cycle. Elimination of standalone Action Mappings. Resolution of duplicate Theme keys. Removal of full-page blob execution.

## Non-goals
- Re-architecting the n8n orchestrator or routing layer.
- Changing Phase 0 core objectives.

## Constraints (Phase 0 rules)
- Must follow 7-Gate Phase Model.
- Must inherit Constitution v2.2 and architecture boundary constraints.
- Implementers write Unit/local E2E, Validator writes gap reports.

## Acceptance Criteria (observable bullets)
- [ ] Theme: Duplicate themes prevented, configurable fidelity established, swatches act as preview-only.
- [ ] Block: Action Mapping subsumed logically into Detection Review. Browse is default view.
- [ ] Page: Strict composition requiring atomic Block extraction; rejecting direct full-page creation.
- [ ] Shell: Single global app shell structure remains active; configurations supported.
- [ ] Widget: Repo-first onboarding strictly enforced mapping logic apart from pure UI Blocks.
- [ ] Validation: Gate 5 execution of `TEST-004` accurately spots UI/Persistence drift.

## Telemetry / Analytics
TBD.

## Links
- Spec: SPEC-004
- Tasks: TASK-004
- Proof: PROOF-004
- Tests: TEST-004
- ADRs: ADR-004A through G
