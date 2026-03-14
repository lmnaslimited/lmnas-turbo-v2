# VALIDATION-MATRIX-003 - Test Strategy for Platform Validation

## Linked Spec: SPEC-003

## Purpose
This matrix directs the Validator Agent on exactly what must be tested, expected behaviors, and how to grade implementations. The Validator must *only* report on condition satisfaction; under no circumstances should it automatically patch or fix failing items.

| Requirement ID | Expected Implementation Evidence | Test Type | Pass/Fail Criteria | Typical Failure Modes |
| -------------- | -------------------------------- | --------- | ------------------ | --------------------- |
| **Theme-WF-01** | Theme Workflow properly freezes the active theme. Changes issue an alert limit. | Doc Review & UI Walkthrough | PASS: User can review/activate theme. FAIL: Multiple active themes or regressions unaddressed. | Changing themes breaks existing block styles. |
| **Block-WF-01** | Block Import imports blocks only; no page elements. | Integration / E2E | PASS: No page slug generated. FAIL: Full-page payload executes. | Platform creates a route slug rather than a raw component. |
| **Shell-WF-01** | Shell browser activates a specific variant. | UI Walkthrough | PASS: Navbar/Menu update dynamically based on active shell. | Changes locally reflect but aren't actively bound to platform. |
| **Page-WF-01** | Page assembly leverages exclusively existing studio blocks. | Integration | PASS: New pages construct via payload. FAIL: Unknown components bypass studio. | Non-studio ad-hoc blocks permitted. |
| **Page-WF-02** | Page-level action config overrides block-level defaults. | E2E | PASS: Action at page level resolves perfectly over block prop. | Block props bleed into page definition ignoring local override. |
| **Prev-01** | Distinguish Reference Preview from Production Preview. | Visual Regression | PASS: Ref viewer displays source, Prod viewer displays thematic render. | Reference CDNs act as live render payloads bypassing thematic pipeline. |
| **Fidelity-01** | Fidelity score computes variation and signals debt. | E2E | PASS: Scores rendered clearly. Low scores block workflow or prompt user. | Score fails to update during modification iterations. |
| **Persist-01** | Strapi accurately persists active modifications. | Persistence | PASS: Querying Strapi endpoints validates mirrored state. | Local states fall out of sync with downstream CMS truth. |
| **GapRep-01** | Validator generates isolated gap reports on failure. | Doc Review | PASS: Validator rejects task with detailed matrix response. | Validator agent injects immediate runtime patching on its own. |

## Grading Classification
For every test, the validator categorizes the outcome strictly as:
- **Implemented**: Full visual and logic pass against AC.
- **Partial**: Feature works, partial alignment with specification.
- **Missing**: No evidence provided or logic not implemented.
- **Regressed**: Adjacent or dependent feature broke from latest patch.
- **Out of Scope**: Unrequested addition bypassing the Intake governance.

> **Instruction for Validator Agent:** 
> Issue your gap report and designate the agent type (Claud/Codex) required as "Next Implementer" to resolve findings. Do not attempt a codebase commit.
