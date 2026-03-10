# SPEC-003 - Platform Governance and RR Enforcement Updates

## Linked Intake: INT-003

## Scope
Documentation-only update to platform requirement processes, ensuring strict agent boundaries and a formalized 4-workflow model. This spec defines the processes, rules, and boundaries to be adhered to during platform generation and validation.

## Non-goals
- Generating boilerplate frontend code.
- Editing existing layout or React component files.

## 4-Workflow Model Boundaries
1. **Theme Workflow**
   - **Allowed**: Deriving a project theme from a reference, browsing, reviewing, and activating *one* single project-level theme.
   - **Disallowed**: Changing the active theme frequently without regression checks.
   - **Input**: Reference design/page.
   - **Output**: An approved, frozen theme configuration.
2. **Block Import Workflow**
   - **Allowed**: Importing raw blocks, evaluating reference preview, publishing components.
   - **Disallowed**: Full-page imports, page creation, creating/editing page slugs.
   - **Input**: External block assets.
   - **Output**: Reusable block/component structures only.
3. **Shell Workflow**
   - **Allowed**: Managing shell variants (navbar, footer, menu, actions), activating a single shell.
   - **Disallowed**: Mixing shell components with block import payloads.
   - **Input**: Core shell configurations.
   - **Output**: Activated Platform Shell.
4. **Page Workflow**
   - **Allowed**: Assembling pages strictly from imported Studio blocks. Applying active shell automatically. Overriding component actions via page-level action config. Syncing pages to Strapi.
   - **Disallowed**: Defining new blocks on the fly.
   - **Input**: Selected blocks, Action Overrides.
   - **Output**: Persisted Strapi page structure, rendered under active Theme.

## Previews and Fidelity
- **Reference Preview**: Verifies source correctness. Does *not* represent the final site.
- **Production Preview**: Authoritatively renders content through the active project theme.
- **Theme Debt & Fidelity Score**: A quantitative measure comparing Reference vs Product views. A low fidelity score triggers either a source adaptation recommendation or a Theme Workflow revisit.

## Validator Responsibilities
The Validator (Gemini) checks Proof artifacts against the Spec. Output classifications:
- **Implemented**: Matches AC entirely.
- **Partial**: Feature works, but gaps remain.
- **Missing**: AC completely unaddressed.
- **Regressed**: Previously working feature damaged.
- **Out of Scope**: Implementer added unrequested logic.
The Validator *will not* automatically fix code. It solely issues a Gap Report and designates the recommended implementer.

## Files to Create/Modify
| Path | Change Type | Reason |
| --- | --- | --- |
| `docs/architecture/LMNAs_Platform_Operating_Constitution_v2_2.md` | CREATE | Baseline constitution upgrade for RR rules. |
| `docs/phase0_1/templates/proof.template.md` | MODIFY | Ensure evidence-led closure. |
| `docs/phase0_1/specs/VALIDATION-MATRIX-003.md` | CREATE | Matrix guiding Validator agent actions. |

## Test Plan (unit/integration/e2e)
Validation to be exclusively handled by the external Validator persona comparing the resulting repository artifacts to this Spec.

## Rollout / Risk notes
Must freeze current implementation behaviors. Master Architecture agent should parse the new Constitution before directing further Phase 0 work.

## Links (Tasks/Proof placeholders)
- Tasks: TASK-003
- Proof: PROOF-003
- Validation Matrix: VALIDATION-MATRIX-003.md
