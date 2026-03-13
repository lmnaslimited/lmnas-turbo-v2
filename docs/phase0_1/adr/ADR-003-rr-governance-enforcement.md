# ADR-003 - Strict RR Governance and Independent Validation Model

## Linked Documents
- **Intake**: INT-003
- **Spec**: SPEC-003

## Context
Implementation agents tend to speculate and propose coding shortcuts or fix issues autonomously, generating code before the architectural requirements are fully bounded. This bypasses the Requirement & Roadmap (RR) layer, risking structural integrity. Additionally, the boundaries between the 4 workflows (Theme, Block Import, Shell, Page) run the risk of blurring without strict procedural rules.

## Decision
We mandate a Documentation-First, "RR-Governed" development loop with an explicitly separated Validator role:
1. **Requirements First**: No UI/Integration implementation begins without an approved RR packet.
2. **Explicit Workflow Isolation**: The platform supports exactly four strict workflows (Theme, Block, Shell, Page), each with isolated boundaries (e.g. Block Import can *never* create a page slug).
3. **Independent Agent Validation**: The `Validator` (Gemini) must strictly be a separate role from the `Implementers` (Claude / Codex). The Validator evaluates artifacts against evidence, reports gaps, but *does not* auto-fix.
4. **Evidence-Based Closure**: Claims of task completion are rejected. Proof requires concrete evidence (screencaps, test logs, explicit Strapi assertion outputs).

## Consequences
- **Positive**: Prevents architectural drift. Ensures total alignment between what is specified and what is implemented. Identifies exact locations where implementations deviate from the spec. 
- **Negative**: Increases the upfront documentation overhead. May artificially slow down trivial bug fixes because an RR artifact trail is required for everything.
- **Mitigation**: Standardized RR templates (Intake, Spec, Task, Proof) keep the overhead uniform and predictable.

## Approvers
- Master Architect (ChatGPT)
