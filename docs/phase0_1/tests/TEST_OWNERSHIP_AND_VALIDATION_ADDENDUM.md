# TEST OWNERSHIP AND VALIDATION ADDENDUM

**Role:** Requirements, Validation, and Test Governance Owner  
**Objective:** Eliminate ambiguity in test ownership by formalizing the 4-Persona delivery cycle and strict Phase Gates for LMNAs Studio Phase 0.1.

---

## 1. TEST OWNERSHIP MODEL

Testing responsibilities are explicitly segregated to prevent implementation drift and bias. 

- **Unit Tests**: Owned and executed by Implementers (`Claude` / `Codex`).
- **Implementation-Side E2E Tests**: Owned and executed by Implementers (`Claude` / `Codex`) to verify their own code structural integrity before handoff.
- **Independent Validation Tests**: Owned and executed by the Validator (`Gemini`).
- **UI Workflow Validation**: Owned by the Validator (`Gemini`).
- **Strapi Persistence Validation**: Owned by the Validator (`Gemini`), though Implementers create the verification paths.
- **Integration Validation**: Owned by the Validator (`Gemini`).
- **Regression Validation**: Owned by the Validator (`Gemini`).
- **Defect Triage After Validation**: Owned by the Validator (`Gemini`), returning categorized gap reports.
- **Sign-Off Recommendation**: Owned exclusively by the Validator (`Gemini`).

**Crucial Constraint:** The Validator (`Gemini`) *never* writes implementation code, unit tests, or fixes bugs. The Implementers (`Claude`/`Codex`) *never* validate their own final delivery against the formal RR artifacts.

---

## 2. DELIVERY GATE MODEL

The Phase 0.1 Development Lifecycle consists of rigorous gates. No gate may be skipped.

| Gate | Name | Owner | Entry Criteria | Exit Criteria | Required Artifacts |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Gate 1** | Architecture Locked | `ChatGPT` | Problem defined; product boundary identified. | Phase 0 rules and fixed boundaries legally established. | `Constitution`, `ARCHITECTURE.md` |
| **Gate 2** | Requirements + RR Artifacts Locked | `Gemini` | Gate 1 complete; Intake drafted. | Specifications, Test Plans, ADRs, and Task matrices finalized. | `INT`, `SPEC`, `ADR`, `TASK` |
| **Gate 3** | Implementation Complete (w/ Unit Tests) | `Claude`/`Codex` | Tasks assigned; Dev starts. | Feature integrated; unit tests pass locally. | Unit test logs |
| **Gate 4** | Implementation-Side E2E Complete | `Claude`/`Codex` | Gate 3 complete. | Dev-side E2E scripts pass without fatal crashes. | Local E2E test logs |
| **Gate 5** | Independent Validation Complete | `Gemini` | `PROOF` draft submitted by Implementers. | Gap Report generated detailing pass/fail constraints. | `PROOF` doc updated with findings |
| **Gate 6** | Gap Remediation | `Claude`/`Codex` | Gap Report is populated with failures. | All assigned gaps are re-coded and re-tested locally. | Updated local test logs |
| **Gate 7** | Final Validation & Sign-Off | `Gemini` | Implementers submit remediated `PROOF`. | Zero critical/high gaps. Sign-off Recommended. | Finalized `PROOF` |

---

## 3. TEST EXECUTION SPLIT

### A. Claude/Codex (Implementation Testing)
**Mandatory Minimums:**
- Must write execution-level unit tests for all created UI components and API handlers.
- Must perform local UI workflow tests to ensure components load visually.
- Must run implementation-side E2E (e.g., Playwright/Cypress) checking standard happy-paths.
- Must execute Strapi persistence checks locally to verify data writes do not throw 500 errors.

### B. Gemini (Independent Validation Testing)
**Mandatory Minimums:**
- Must map every observable output against the `SPEC`/`INT` acceptance criteria.
- Must perform UI workflow validation to ensure user intent pathways work.
- Must validate Strapi persistence by directly querying output entities.
- Must detect UX/Logic mismatch between documented architecture and actual render (e.g., "Page blob creation" vs "Atomic Block creation").
- Must generate and return actionable gap reports back to the Implementer.

---

## 4. GEMINI VALIDATOR ROLE

The Gemini Validator acts strictly as a quality control agent anchored to the Specification. 
1. **No Auto-Fixing:** Gemini will strictly NOT fix implementation code. 
2. **No Scope Creep:** Gemini will strictly NOT silently reinterpret requirements or accept "better looking" code if it violates the `SPEC`.
3. **Artifact Supremacy:** Tests are conducted exclusively against the approved RR boundary.
4. **Classification:** Every finding must be classified as:
    - *Requirement Gap*: Feature not built.
    - *Implementation Bug*: Feature built but crashes / errors.
    - *UX Inconsistency*: Built, but diverges from UI standards or architectural definitions.
    - *Documentation Drift*: The implementation requires a docs update (requires `ChatGPT` approval).
    - *Test Coverage Gap*: Implementer failed to write adequate unit/E2E test layers.

---

## 5. ISSUE ASSIGNMENT FORMAT

When an issue is discovered at Gate 5/7, Gemini must output a gap log using exactly this format in the PROOF artifact:

```markdown
### Gap ID: [G-001]
- **Workflow**: [Theme / Block / Page / Shell / Widget]
- **Severity**: [Critical / High / Medium / Low]
- **Category**: [Requirement Gap / Implementation Bug / UX Inconsistency / Documentation Drift / Test Coverage Gap]
- **Requirement/Test Reference**: [SPEC-### / TEST-###]
- **Observed Behavior**: [What actually happened]
- **Expected Behavior**: [What should have happened according to SPEC]
- **Reproduction Path**: 
  1. [Step 1]
  2. [Step 2]
- **Evidence Expected**: [e.g., Strapi record link, Screenshot of overlap viewer]
- **Recommended Owner**: [Claude (UI) / Codex (Integration)]
- **Retest Condition**: [Exact condition that triggers Gate 5 re-evaluation]
```

---

## 6. FAILURE / REWORK LOOP

When a Gap is logged during Gate 5 Validation:
1. **Assignment**: Gemini shifts the phase status to Gate 6, returning the filled Issue Assignment Format to Claude/Codex.
2. **Implementer Constraint**: Claude/Codex must fix the specified gaps. They may *not* invent new features to bypass the gap.
3. **Retesting rules**: 
    - If the gap is *Medium/Low* (e.g., CSS drift), Gemini executes a **Targeted Retest** on that specific component.
    - If the gap is *Critical/High* (e.g., Duplicate ID injection, Strapi save failure), Gemini must execute a **Full Regression Rerun** of the entire required validation test pack.

---

## 7. SIGN-OFF RULE

- Gemini retains absolute, independent authority over the recommendation of "Sign-Off" for Phase Implementation.
- Gemini may ONLY recommend sign-off if Gate 7 evaluates to 0 Critical/0 High severity bugs, and all observable outputs adhere tightly to the `SPEC`.
- Gemini is forbidden from arbitrarily altering the `SPEC` to force a sign-off.
- Final Architectural / Merge Sign-off remains the sole authority of the Master Architect (`ChatGPT`) reading Gemini's recommendation.
