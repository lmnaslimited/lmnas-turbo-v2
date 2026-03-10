# TEST OWNERSHIP AND VALIDATION ADDENDUM

**Role:** Requirements, Validation, and Test Governance Owner  
**Objective:** Eliminate ambiguity in test ownership by formalizing the 4-Persona delivery cycle, strict Phase Gates, and exact Proof expectations.

---

## 1. TEST OWNERSHIP MODEL

Testing responsibilities are explicitly segregated to prevent implementation drift and bias. 

- **Unit Tests**: Owned and executed by Implementers (`Claude` / `Codex`).
- **Implementation-Side E2E Tests**: Owned and executed by Implementers (`Claude` / `Codex`).
- **Independent Validation Tests**: Owned and executed by the Validator (`Gemini`).
- **UI Workflow Validation**: Owned by the Validator (`Gemini`).
- **Strapi Persistence Validation**: Owned by the Validator (`Gemini`).
- **Integration Validation**: Owned by the Validator (`Gemini`).
- **Regression Validation**: Owned by the Validator (`Gemini`).
- **Defect Triage After Validation**: Owned by the Validator (`Gemini`), returning categorized gap reports.
- **Sign-Off Recommendation**: Owned exclusively by the Validator (`Gemini`).

---

## 2. DELIVERY GATE MODEL

The Phase 0.1 Development Lifecycle consists of rigorous gates. No gate may be skipped.

| Gate | Name | Owner | Entry Criteria | Exit Criteria | Required Artifacts |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Gate 1** | Architecture Locked | `ChatGPT` | Problem defined; product boundary identified. | Phase 0 rules established. | `Constitution`, `ARCHITECTURE.md` |
| **Gate 2** | Requirements + RR Artifacts Locked | `Gemini` | Gate 1 complete; Intake drafted. | Specifications, Test Plans, ADRs finalized. | `INT`, `SPEC`, `ADR`, `TASK` |
| **Gate 3** | Implementation Complete (w/ Unit Tests) | `Claude`/`Codex` | Tasks assigned; Dev starts. | Feature integrated; unit tests pass locally. | Unit test logs |
| **Gate 4** | Implementation-Side E2E Complete | `Claude`/`Codex` | Gate 3 complete. | Dev-side E2E scripts pass without crash. | Local E2E test logs |
| **Gate 5** | Independent Validation Complete | `Gemini` | `PROOF` draft submitted. | Gap Report generated detailing pass/fail constraints. | `PROOF` updated with Issue formats |
| **Gate 6** | Gap Remediation | `Claude`/`Codex` | Gap log is populated with failures. | Assigned gaps re-coded and re-tested locally. | Updated local test logs |
| **Gate 7** | Final Validation & Sign-Off | `Gemini` | Remediated `PROOF` submitted. | Zero critical/high gaps. Sign-off Recommended. | Finalized `PROOF` |

---

## 3. TEST EXECUTION SPLIT

### A. Claude/Codex (Implementation Testing)
Required: Unit tests for components; local workflow tests; implementation-side E2E checks ensuring basic logic operates; manual console persistence checks.

### B. Gemini (Independent Validation Testing)
Required: Requirement-to-implementation mapping validation; strict UI testing; independent DB persistence validation; mismatch detection vs Architecture boundaries; execution of explicit `TEST-004` pack. Gemini never writes patches.

---

## 4. GEMINI VALIDATOR ROLE
- **Constraint 1:** Gemini must NOT fix code.
- **Constraint 2:** Gemini must NOT silently reinterpret requirements.
- **Constraint 3:** Gemini must test specifically against the approved RR boundary.
- **Categorization:** Reports identify: `requirement gap`, `implementation bug`, `UX inconsistency`, `documentation drift`, or `test coverage gap`.

---

## 5. ISSUE ASSIGNMENT FORMAT

Gemini uses the exact block below when halting Gate 5:

```markdown
### Gap ID: [G-001]
- **Workflow**: [Theme / Block / Page / Shell / Widget]
- **Severity**: [Critical / High / Medium / Low]
- **Category**: [Gap Category]
- **Requirement/Test Reference**: [SPEC-### / TEST-###]
- **Observed Behavior**: [Actual]
- **Expected Behavior**: [According to SPEC]
- **Reproduction Path**: 
  1. [Step 1]
- **Evidence Expected**: [Visual / Log proof]
- **Recommended Owner**: [Claude / Codex]
- **Retest Condition**: [Gate 5 exit trigger]
```

---

## 6. REQUIRED VALIDATION PACK

The exact matrix mapped into `docs/phase0_1/tests/TEST-004-studio-workflow-tightening.md` must be executed rigidly matching `TV-E2E-01` through `TV-MTR-10`.

---

## 7. EVIDENCE STANDARD FOR VALIDATION

Implementer assertions (e.g., "Files generated") are universally invalid. Gemini must collect:
- **Screenshots:** Validating overlaps, Swatch toggles, error traps, or Draft/Prod views.
- **State Comparisons:** Before/After states of Where-Used logic blocks.
- **Strapi Entity Dumps:** JSON outputs mapping block UI arrays.
- **Logs:** Fidelity calculation numeric shifts or GitHub CI E2E run outputs.
- **Identifers:** Specific node limits.

---

## 8. FAILURE / REWORK LOOP

When an issue logs during Gate 5 Validation:
1. Gemini shifts phase status to Gate 6 returning the format to Claude/Codex.
2. Implementers fix specifically identified gaps without scope-bloat.
3. Gemini reruns Targeted Pack for Low/Med severity or Full Regression Pack for High/Critical bugs.

---

## 9. SIGN-OFF RULE

Gemini explicitly commands the Sign-Off recommendation at Gate 7 only when evidence passes against approved RR requirements. Architecture sign-off (Gate 1 boundary changes) remains outside Gemini's authority and sits strictly with ChatGPT.

---

## 10. INSERTION MAP

This addendum governs Phase 0.1 testing execution. It is centrally anchored:
- **Primary Source:** `docs/phase0_1/tests/TEST_OWNERSHIP_AND_VALIDATION_ADDENDUM.md`
- **Governed Files:**
    - `README.md` (Pointers updated protecting Phase 0.1 7-Gate Rules)
    - `AGENTS.md` (Requires adherence to Gemini Validator limits)
    - `docs/phase0_1/templates/proof.template.md` (Embeds Section 5 Issue format)
    - `docs/phase0_1/templates/tasks.template.md` (Embeds Section 2 Gate Map)
