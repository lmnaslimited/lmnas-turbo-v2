# SPEC-004 - Studio Workflow Tightening Specification

## Linked Intake: INT-004

## Scope
Formalizing workflow limitations preventing Claude/Codex execution drift. Defines the strict UX bounds for Themes, Blocks, Pages, Rules, Widgets, and the centralized fidelity configuration matrix.

## Non-goals
- Adding dynamic routing.
- Re-theming the Studio frontend UI styling.

## UX Flow Constraints
- **Theme**: Users must be able to upload sources, activate ONE target theme, preview swatches globally, and delete archived themes. Deletion requires refresh persistence.
- **Block**: Browse is default view. Detection Review must visually include/incorporate Action Mapping natively. Final Review view leverages strictly active Production state. Overlap/overlay viewing is present for fidelity calculation.
- **Shell**: Configure Navbar/Footer behaviors natively inside Shell list context.
- **Page**: Pages are composed dynamically from studio blocks.

## Data Flow
- Inputs -> [Duplicate Validation] -> [Extraction] -> Output Object
- No `theme-timestamp` key conflicts are permissible. 

## Interfaces / Contracts impacted
- `apps/site/app/platform/onboarding/*` UI Routes.
- `apps/site/app/api/platform/studio/themes*` API handlers.

## Files to Create/Modify
| Path | Change Type | Reason |
| --- | --- | --- |
| `AGENTS.md` | MODIFY | Enforce agent gate discipline and publish API parity. |
| `docs/phase0_1/templates/*` | MODIFY | Inject Gate rules and explicit failure log structs. |
| `Studio Block UIs` | MODIFY | Refactor action mapping natively to the detection step. |

## Test Plan
See strictly documented `TEST-004` pack to be executed unconditionally by the Gemini Validator.

## Links
- Tasks: TASK-004
- Proof: PROOF-004
- Tests: TEST-004
