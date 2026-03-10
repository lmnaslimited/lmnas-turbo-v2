# TASK-003 - Platform Governance and RR Enforcement Updates

## Linked Spec: SPEC-003

## Preconditions checklist
- [x] Spec exists and is approved.
- [x] Constitution v2.1 understood.
- [x] Master Architect definitions fully parsed.

## Step-by-step tasks

| Step | Owner | Description | Expected Artifact/Output | Done Criteria |
| --- | --- | --- | --- | --- |
| 1 | **Gemini (RR)** | Draft INT-003, SPEC-003, TASK-003, ADR-003. | RR document set in repo. | Specs correctly reflect constitution rules, 4-workflow model, and independent validation. |
| 2 | **Gemini (RR)** | Draft updated `LMNAs_Platform_Operating_Constitution_v2_2.md` | Constitution v2.2 | Constitution includes sections on Workflow Separation, RR Governance, and Validator independence. |
| 3 | **Architecture** | Review and accept ADR-003 and Constitution v2.2 changes. | Approved ADR | Master Architect (ChatGPT) signals approval of documentation updates. |
| 4 | **Gemini (RR)** | Update `proof.template.md` to be evidence-based | Template file | PROOF requires screenshots, test logs, coverage tables, no generic claims. |
| 5 | **Gemini (RR)** | Draft `VALIDATION-MATRIX-003.md` for the test strategy. | Matrix file | Outlines tests for all 4 workflows, Strapi persistence, and Fidelity calculation. |
| 6 | **Claude (UI)** | Provide sample UI implementation for a component mapping (Only when spec is valid). | Rendered UI | Claude's outputs are limited strictly to UI mapping per RR spec. |
| 7 | **Codex (Integr)** | Complete data integration linking (Strapi to component). | API Bindings | Codex handles the persistence layer exactly as requested by RR. |
| 8 | **Gemini (Val)** | Execute gap report based on Validation Matrix against Proof. | Gap Report | Recommends 'Ready' or provides an exception list; auto-fixing is strictly bypassed. |

## Commands to run
- `pnpm phase0:guard -- --id 003`

## Completion Checklist mapping to Acceptance Criteria
- [ ] TASK correctly delegates to distinct agent bounds: Architecture, UI, Integration, Validation.
- [ ] Requirements definitively precede Claude/Codex execution.
- [ ] Validation is purely a checking workflow, lacking auto-fix shortcuts.
