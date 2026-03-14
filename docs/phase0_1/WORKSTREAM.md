# Phase 0.1 Workstream Control Panel

## Active items

| ID | Title | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| 001A | snapshot-sanitizer | Codex | Closed | Sanitizer contract and tests exist; see `PROOF-001A`. |
| 003 | rr-governance-enforcement | Gemini / ChatGPT | Closed | Authority freeze corrected to Constitution v2.1; see `PROOF-003`. |
| 004 | studio-workflow-tightening | Codex / Arun / Gemini | Partial | Gates 0-5, 8, 9 updated in proof; Gate 6 open, Gate 7 partial. |

## Current merge-gate status

| Gate | Status | Source of truth |
| --- | --- | --- |
| 0 | Closed | `PROOF-003`, `README.md`, Constitution headers |
| 1 | Closed | `PROOF-004`, canonical route tests |
| 2 | Closed | `PROOF-004`, governed runtime code/tests |
| 3 | Closed | `PROOF-004`, runtime guardrails + tests |
| 4 | Closed | `PROOF-004`, metadata + live/preview separation evidence |
| 5 | Closed | `PROOF-001A`, `PROOF-004`, sanitizer tests |
| 6 | Open | first-class canonical settings not implemented yet |
| 7 | Partial | page workflow parity improved; cross-workflow parity coverage incomplete |
| 8 | Closed | executable commands/results recorded in `PROOF-004` |
| 9 | Closed | RR / proof / workstream / addendum updated to match implementation state |

## Next actions

- Implement first-class canonical studio settings so fidelity mode/threshold no longer persist through `themeDebt`.
- Add real-stack parity coverage for theme / shell / widget action menus and reopen/edit flows.
- Hand the updated proof set to ChatGPT for architecture review and Arun for functional/UX review before Gemini validation.
