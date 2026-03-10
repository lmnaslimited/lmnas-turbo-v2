# TEST-004 - Studio Workflow Tightening Validator Pack

## Linked Spec: SPEC-004
## Test Ownership Models
- **Claude / Codex**: Responsible for Implementation-side local E2E ensuring these tests do not hard-crash (Gate 4).
- **Gemini**: Responsible for Independent Validation against these precise requirements (Gate 5).

---

## Part 1: Mandatory Validator E2E Baseline
*Owner: Gemini (Independent Verification)*

| Test ID | Linked REQs | Preconditions | Steps | Expected Result | Evidence Required |
| --- | --- | --- | --- | --- | --- |
| `TV-E2E-01` | REQ-CLN-01 | Local server running | Execute cleanup sequence / assert DB empty. | Legacy blocks (faq/hero) purged. DB sterile. | Strapi DB query output. |
| `TV-E2E-02` | REQ-[THM-01/BLK/PAG] | `TV-E2E-01` passed | Ingest `docs/testing-artifacts/code.html` to generate Theme, Shells, and Blocks. | Components successfully extract into UI blocks without generating an active Page route slug. | Test log of ingestion output. |
| `TV-E2E-03` | REQ-THM-03 | `TV-E2E-02` passed | Re-upload `docs/testing-artifacts/code.html` maintaining identical names. | System triggers duplicate warning dialogue. No React collision / DB overwrite occurs. | UI error screenshot / JSON reject log. |
| `TV-E2E-04` | REQ-PAG-01 | Blocks exist | Assemble new Page consuming isolated extracted blocks. | Page persists natively inside DB. | Strapi Page payload block. |
| `TV-E2E-05` | REQ-[WID-01/PAG-01] | `TV-E2E-04` passed | Inject repo-first Logic Widget (calendar) into Page. Assemble a second Page re-using blocks. | Widget integrates successfully. Second Page constructs independently sharing block structures safely. | UI rendering screenshot of both pages. |

---

## Part 2: Matrix Validation Validation
*Owner: Gemini (Independent Verification)*

| Test ID | Linked REQs | Preconditions | Steps | Expected Result | Evidence Required |
| --- | --- | --- | --- | --- | --- |
| `TV-MTR-01` | REQ-THM-02 | Theme active | Toggle Preview Swatch, observe UI. Refresh page. | Swatch alters UI immediately. Refresh strips swatch back to Production Active state. | Before/after UI screenshots. |
| `TV-MTR-02` | REQ-THM-03 | Uploading Theme | Select theme during derive phase. | Sample preview displays accurately allowing visual review before persistence. | UI sample screenshot. |
| `TV-MTR-03` | REQ-BLK-01 | `TV-E2E-04` passed | Attempt to Delete block tied to `TV-E2E-04` Page. | "Where Used" dependency warning blocks deletion sequence. | Rejection modal screenshot. |
| `TV-MTR-04` | REQ-BLK-[01/02] | Blocks exist | Navigate `/blocks`. Observe listing. Review Action Mapping integration natively in block UX. | List defaults to Browse. Generic Actions isolated natively to specific Block contexts. | Screenshot of Browse default + Action UI. |
| `TV-MTR-05` | REQ-BLK-03 | Blocks loaded | Disable simulated CDN / strip source URLs. | Blocks render natively using platform Tailwind structural fallbacks safely. | Fallback UI screenshot. |
| `TV-MTR-06` | REQ-PUB-01 | Theme / Swatch exist | Apply Swatch. Navigate to Final Publish Review. | Publish screen rigidly ignores Swatch, showing only true Active Theme styling. | UI Validation screenshot. |
| `TV-MTR-07` | REQ-PUB-02 | Ingest HTML | Ingest document possessing `@media(dark)`. Observe Fidelity threshold in 'allow' mode. | Fidelity calculator tracks Dark mode inversion. Logs warning but permits publish safely under 'allow-below-threshold' logic. | Fidelity threshold JSON output log. |
| `TV-MTR-08` | REQ-SHL-01 | Dashboard | Navigate to Shell Menu config. Map new Footer route. | Parity UI triggers; Footer logic maps globally across app matching generic Block list UI designs. | Strapi Shell payload diff. |
| `TV-MTR-09` | REQ-PAG-02 | `TV-E2E-04` passed | View assembled page. Toggle Draft/Prod mode. | Draft vs Prod previews shift precisely reflecting current edit state capabilities. | UI toggle verification screenshots. |
| `TV-MTR-10` | REQ-WID-01 | Upload screen | Upload raw JS locally. Then map valid repo-path widget. Trigger logic in builder. | Raw JS fails sandbox. Repo path authenticates, seamlessly maps visually into Studio placement, and executes interaction logic successfully. | Rejection log / Placement layout DB commit / Functional execution record. |
| `TV-MTR-11` | REQ-PUB-02 | Studio Settings | Switch setting to 'disallow-below-threshold'. Attempt `TV-MTR-07` ingestion again. | Fidelity engine explicitly hard-blocks the publish sequence, requiring formal resolution. | UI publish rejection error log / screenshot. |
