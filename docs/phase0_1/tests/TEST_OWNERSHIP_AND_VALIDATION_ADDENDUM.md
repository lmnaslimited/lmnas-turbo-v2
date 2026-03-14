# TEST OWNERSHIP AND VALIDATION ADDENDUM

## 1. Binding authority

- Constitution v2.1 is the binding authority for Phase 0.1.
- `docs/architecture/LMNAs_Platform_Operating_Constitution_v2_2.md` is draft / non-binding until Arun explicitly supersedes v2.1.

## 2. Role split

- `Codex`: implementation, unit tests, implementation-side integration/E2E, executable proof collection.
- `ChatGPT`: architecture review against the binding constitution and RR scope.
- `Arun`: functional and UX review of operator-facing behavior.
- `Gemini`: independent validation against `SPEC` / `TEST`; gap reports only; no code changes or auto-fixes.

## 3. Delivery gates

| Gate | Name | Owner | Exit evidence |
| --- | --- | --- | --- |
| 1 | Architecture Locked | `ChatGPT` | Constitution + architecture review notes |
| 2 | RR Locked | `Gemini` | `INT` / `SPEC` / `ADR` / `TASK` |
| 3 | Implementation Complete | `Codex` | Passing unit / integration command logs |
| 4 | Implementation-side E2E Complete | `Codex` | Passing local E2E / real-stack command logs |
| 5 | Independent Validation | `Gemini` | Gap report against locked RR artifacts |
| 6 | Gap Remediation | `Codex` | Updated passing command logs |
| 7 | Functional / UX Review + Final Validation | `Arun`, `Gemini` | Functional review notes + validator sign-off |

## 4. Evidence standard

- Executable evidence is mandatory for any closed gate.
- Exact commands and exact results must be recorded in `PROOF`.
- JSON / log / persisted-record evidence is required where persistence or runtime governance is claimed.
- Screenshots are optional supplemental artifacts only. Screenshots do not close a gate on their own.

## 5. Validator constraints

- Gemini validates strictly against the approved RR boundary.
- Gemini reports `requirement gap`, `implementation bug`, `UX inconsistency`, `documentation drift`, or `test coverage gap`.
- Gemini does not patch code, rewrite tests, or reinterpret requirements after implementation.

## 6. Required cross-references

- `README.md` must point to Constitution v2.1 as authoritative.
- `PROOF-003` must record constitutional authority freeze status.
- `PROOF-004` must record executable evidence for implementation-side closure and must explicitly mark any still-open merge gate with exact blockers.
