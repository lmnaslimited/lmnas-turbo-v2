# IMPLEMENTATION ORCHESTRATION PACK
**Target:** Studio Workflow Tightening (Phase 0.1)
**Orchestrator:** Gemini
**Execution Agents:** Claude, Codex

## 1. EXECUTION SEQUENCE

The implementation of `SPEC-004` must be executed rigidly in the following sequence to prevent cascading dependency failures and ensure testability.

### Phase A: Control-Point and Setup Alignment
- **Parallelism**: Sequential only
- **Purpose**: Establish baseline environment, align architecture guardrails, and prepare testing harnesses.
- **Requirement IDs**: `REQ-GOV-01` (Test Traceability), Gate 3 Entry Criteria.
- **Why order is mandatory**: Cannot build workflow routes without standard environment assumptions; precondition for `TV-E2E-01`.
- **Entry Criteria**: Gate 2 complete. Intake, Specs, Tests approved.
- **Exit Criteria**: Developer environment running locally; Next.js and Strapi running without errors.
- **Blockers**: Pending DB migrations or missing `.env` variables.
- **Dependencies**: None.
- **Outputs**: Local environments active.

### Phase B: Cleanup + Test Baseline
- **Parallelism**: Sequential only (Blocked until Phase A)
- **Purpose**: Ensure test harnesses start from a sterile DB before any new components are built.
- **Requirement IDs**: `REQ-CLN-01`
- **Why order is mandatory**: The mandatory `TV-E2E-01` test requires a sterile environment as the first step of the independent validation matrix.
- **Entry Criteria**: Phase A fully complete and passing boot logs.
- **Exit Criteria**: Running the wipe script successfully deletes legacy `faq`/`hero` blocks, outputting a sterile DB JSON dump.
- **Blockers**: Local server must be running (Phase A).
- **Dependencies**: Phase A.
- **Outputs**: DB wipe script or test harness hook, sterile Strapi instance.

### Phase C: Shared/Reusable Workflow Foundation
- **Parallelism**: Sequential only (Blocked until Phase B)
- **Purpose**: Implement the global UI patterns (List/Detail/Action Menus) that all subsequent workflows will inherit.
- **Requirement IDs**: `REQ-STU-01`
- **Why order is mandatory**: Theme, Block, and Shell workflows require these containers to render properly without UI fragmentation.
- **Entry Criteria**: Phase B baseline established.
- **Exit Criteria**: Shared UI components exist in the repository and compile without errors in at least one mockup route.
- **Blockers**: Phase B Baseline execution.
- **Dependencies**: Phase B.
- **Outputs**: Reusable React components for Block/Page/Theme listings.

### Phase D: Theme Workflow
- **Parallelism**: Safe bounded parallel (Blocked until Phase C)
- **Purpose**: Enable bounded upload of themes, rendering of swatches vs active states, and trap duplicate keys.
- **Requirement IDs**: `REQ-THM-01`, `REQ-THM-02`, `REQ-THM-03`
- **Why order is mandatory**: Blocks and Pages need styling context to render previews.
- **Entry Criteria**: Phase C Foundation logic available as exported components.
- **Exit Criteria**: Uploading duplicate theme keys explicitly triggers a UI warning modal halting the API call. Uploading non-approved MIME types returns a rejection validation error.
- **Blockers**: Shared list components from Phase C must be ready.
- **Dependencies**: Phase C.
- **Outputs**: `/themes` route complete. Theme logic isolated in Strapi.

### Phase E: Block Workflow
- **Parallelism**: Safe bounded parallel (Blocked until Phase C)
- **Purpose**: Implement Block ingestion, rendering fallbacks, and generic action mapping via Detection Review.
- **Requirement IDs**: `REQ-BLK-01`, `REQ-BLK-02`, `REQ-BLK-03`
- **Why order is mandatory**: Blocks are the atomic units of Pages. Pages cannot be built without Blocks.
- **Entry Criteria**: Phase C Foundation logic available as exported components.
- **Exit Criteria**: Standalone action mapping routes yield HTTP 404. Attempting to delete a block tied to an active Page triggers a validation rejection.
- **Blockers**: DB Schema for blocks and action mappings must be finalized (Phase C).
- **Dependencies**: Phase C.
- **Outputs**: `/blocks` route complete. Where-used logic active.

### Phase F: Publish / Fidelity Behavior
- **Parallelism**: Sequential only (Blocked until Phase D & E)
- **Purpose**: Enforce WYSIWYG guarantees and fidelity threshold rules before Pages and global states can be published.
- **Requirement IDs**: `REQ-PUB-01`, `REQ-PUB-02`
- **Why order is mandatory**: Publish logic must govern how Shell and Page workflows save their final states.
- **Entry Criteria**: Phases D & E complete (Themes & Blocks exist to be published).
- **Exit Criteria**: Publish API payload explicitly references DB Active Theme, omitting Swatch styling. Fidelity engine hard-blocks the publish UI when configured in 'disallow-below-threshold' mode and dark-mode mismatch is detected.
- **Blockers**: Theme architecture must separate Active vs Swatch securely (Phase D).
- **Dependencies**: Phase D, Phase E.
- **Outputs**: Global Studio Fidelity Setting toggle. Verification Publish overlay component.

### Phase G: Shell Workflow
- **Parallelism**: Safe bounded parallel (Blocked until Phase E)
- **Purpose**: Global app configuration (Navbar/Footer) utilizing the shared Phase C components and Phase E Block schemas.
- **Requirement IDs**: `REQ-SHL-01`
- **Why order is mandatory**: Shell configures the global wrapper that Pages will render inside.
- **Entry Criteria**: Phase C components and Phase E Block states exist.
- **Exit Criteria**: Changes to Navbar/Footer inside Shell mapping explicitly reflect globally across the Next.js UI rendering context.
- **Blockers**: Block schemas must be persisted (Phase E).
- **Dependencies**: Phase C, Phase E.
- **Outputs**: Shell configuration UI and DB state updates.

### Phase H: Page Workflow
- **Parallelism**: Sequential only (Blocked until Phase F & G)
- **Purpose**: Assemble Blocks into coherent route Pages. Ensure HTML import yields blocks and no implicit slugs. Draft/Prod visual parity.
- **Requirement IDs**: `REQ-PAG-01`, `REQ-PAG-02`
- **Why order is mandatory**: Requires Blocks (Phase E), Themes (Phase D), and Publish guarantees (Phase F).
- **Entry Criteria**: Phases F & G complete (Fidelity toggle active, Shell active).
- **Exit Criteria**: A full `code.html` ingestion payload into the Page UX natively extracts blocks into the DB and creates exactly 0 new active Next.js route slugs automatically.
- **Blockers**: Publish Fidelity Guardrails must exist (Phase F).
- **Dependencies**: Phase F, Phase G.
- **Outputs**: `/pages` route complete.

### Phase I: Widget Workflow
- **Parallelism**: Sequential only (Blocked until Phase H)
- **Purpose**: Securely embed logic inside Blocks/Pages using repo-first approach. 
- **Requirement IDs**: `REQ-WID-01`
- **Why order is mandatory**: Widgets inject into Pages and Blocks, so those structures must exist first.
- **Entry Criteria**: Phase H complete (Pages capable of receiving block combinations).
- **Exit Criteria**: Uploading arbitrary `.js` script content actively fails UI validation. Specifying a valid repo-path allows successful functional injection into a mapped block.
- **Blockers**: Page assembly must be stable (Phase H).
- **Dependencies**: Phase H.
- **Outputs**: Widget placement module. Rejected sanitization rules.

### Phase J: Implementation-Side Unit and E2E Test Completion
- **Parallelism**: Sequential only
- **Purpose**: Local verification by Claude/Codex (Gate 3/4).
- **Why order is mandatory**: Developers must prove local stability before independent validation.
- **Entry Criteria**: All code implementation logic complete (Phases A-I).
- **Exit Criteria**: Unit test suite passes locally. Dev-side end-to-end clicks operate without hard crashes.
- **Blockers**: Outstanding implementation bugs.
- **Dependencies**: Phases A-I.
- **Outputs**: Test logs demonstrating no runtime exceptions.

### Phase K: Gemini Validation Handoff
- **Parallelism**: Sequential only
- **Purpose**: Shift from implementation to independent validation (Gate 5).
- **Why order is mandatory**: Final step of implementation orbit.
- **Entry Criteria**: Phase J complete and passing.
- **Exit Criteria**: Gemini ping received specifically containing the structured handoff contract (detailed in Section 4).
- **Blockers**: Any gaps preventing log compilation.
- **Dependencies**: Phase J.
- **Outputs**: Ready-for-validation ping to Gemini along with `PROOF` document references.

---

## 2. CLAUDE/CODEX IMPLEMENTATION INSTRUCTION PACK

### Phase A (Setup)
- **Scope Boundary**: Align environment, prep testing baseline, assert no architecture violations.
- **Docs to Obey**: `TEST_OWNERSHIP_AND_VALIDATION_ADDENDUM` (Gate 2/3 rules).
- **Exact Requirement IDs**: `REQ-GOV-01`
- **What must not change**: Approved Role Split, Phase Gates.
- **Test Obligations**: Prepare environment for `TV-E2E-01`.
- **Evidence Obligations**: Next.js & Strapi boot logs without crash.

### Phase B (Cleanup)
- **Scope Boundary**: Scripts/hooks to purge legacy db states.
- **Docs to Obey**: `SPEC-004`, `TEST-004`.
- **Exact Requirement IDs**: `REQ-CLN-01`
- **What must not change**: Do not drop core Strapi tables, only legacy demo content (`faq`/`hero`).
- **Test Obligations**: Pass `TV-E2E-01` locally.
- **Evidence Obligations**: Strapi DB query output showing sterile state.

### Phase C (Foundation)
- **Scope Boundary**: Build common UI layouts.
- **Docs to Obey**: `SPEC-004`, `ADR-004`, `TASK-004`.
- **Exact Requirement IDs**: `REQ-STU-01`.
- **What must not change**: Do not build the logic for specific entities yet. Only layout containers.
- **Unit Test Obligations**: Snapshot or render unit tests for UI containers.
- **E2E Obligations**: Verify container loads dynamically inside mock host.
- **Evidence Required for Handoff**: Screenshots of empty state UI containers.

### Phase D (Theme)
- **Scope Boundary**: `/themes` route, Strapi theme entity logic, swatch capability.
- **Docs to Obey**: `SPEC-004`, `TEST-004`, `PROOF-004`, `ADR-004`.
- **Exact Requirement IDs**: `REQ-THM-01`, `REQ-THM-02`, `REQ-THM-03`.
- **What must not change**: Active production DB records when applying a preview swatch.
- **Unit Test Obligations**: Pass duplication-trap API test locally.
- **E2E Obligations**: Pass `TV-MTR-01`, `TV-MTR-02` locally.
- **Evidence Required for Handoff**: Screenshot of swatch applied vs active theme, duplicate warning dialog screenshot (`TV-E2E-03`).

### Phase E (Block)
- **Scope Boundary**: `/blocks` route, block fallback styling, action mapping integration, where-used API.
- **Docs to Obey**: `SPEC-004`, `TEST-004`, `TASK-004`.
- **Exact Requirement IDs**: `REQ-BLK-01`, `REQ-BLK-02`, `REQ-BLK-03`.
- **What must not change**: Do not rewrite Tailwind base config to fix fallbacks, utilize structural defaults. Action mapping is handled in Detection Review stage and is not a standalone workflow.
- **Unit Test Obligations**: Verify Tailwind fallback classes load in absence of CDN URL test.
- **E2E Obligations**: Pass `TV-MTR-03`, `TV-MTR-04`, `TV-MTR-05` locally.
- **Evidence Required for Handoff**: "Where-used" rejection modal screenshot, Action generic UI screenshot inside block detail.

### Phase F (Publish Behavior)
- **Scope Boundary**: Publish modal, Fidelity configuration toggle system.
- **Docs to Obey**: `SPEC-004`, `TEST-004`, `TEST_OWNERSHIP_AND_VALIDATION_ADDENDUM`.
- **Exact Requirement IDs**: `REQ-PUB-01`, `REQ-PUB-02`.
- **What must not change**: Swatch UI state; publish strictly fetches Active state from DB.
- **Unit Test Obligations**: Validate fidelity calculator outputs correctly on `@media(dark)` logic test.
- **E2E Obligations**: Pass `TV-MTR-06`, `TV-MTR-07`, `TV-MTR-11` locally.
- **Evidence Required for Handoff**: Log outputs of threshold engine warning (allow mode) vs completely blocking publish (disallow mode).

### Phase G (Shell)
- **Scope Boundary**: `/shell` route mapping.
- **Docs to Obey**: `SPEC-004`, `TEST-004`, `TASK-004`.
- **Exact Requirement IDs**: `REQ-SHL-01`.
- **What must not change**: Global tenancy scope (No tenant-specific logic).
- **Unit Test Obligations**: Shell mapping schema asserts generic DB array mapping.
- **E2E Obligations**: Pass `TV-MTR-08` locally.
- **Evidence Required for Handoff**: UI Screenshot showing configured Shell mapping linking to block arrays.

### Phase H (Page)
- **Scope Boundary**: `/pages` route, HTML ingestion extractor mapping.
- **Docs to Obey**: `SPEC-004`, `TEST-004`, `PROOF-004`.
- **Exact Requirement IDs**: `REQ-PAG-01`, `REQ-PAG-02`.
- **What must not change**: HTML ingest logic strictly isolates component extraction; it must NOT create any dynamic Next.js page slugs directly.
- **Unit Test Obligations**: Ingestion parser checks asserting JSON response block mappings.
- **E2E Obligations**: Pass `TV-E2E-02`, `TV-E2E-04`, `TV-MTR-09` locally.
- **Evidence Required for Handoff**: Strapi DB query showing extracted blocks but precisely zero new page slugs.

### Phase I (Widget)
- **Scope Boundary**: Widget onboarding via local repo paths.
- **Docs to Obey**: `SPEC-004`, `TEST-004`, `ADR-004`.
- **Exact Requirement IDs**: `REQ-WID-01`.
- **What must not change**: Do not execute uploaded `.js`. Only path-based (`/components/widgets/...`) code executes.
- **Unit Test Obligations**: Direct `.js` upload logic assertion fails locally.
- **E2E Obligations**: Pass `TV-E2E-05`, `TV-MTR-10` locally.
- **Evidence Required for Handoff**: Functional execution record of widget within block. Failure log of raw JS upload attempt.

### Phase J-K (Handoff)
- **Instructions**: Run your local E2E loops. Populate your portion of the Proof documentation. Ensure the DB is sterile. Assign Issue return loops to yourselves. Handoff to Gemini following Section 4 requirements perfectly.

---

## 3. PARALLELISM / AUTONOMY PLAN

Implementers have tight autonomy within defined phases but cross-phase execution is rigidly controlled.

- **Phase A (Setup)**: Sequential only
- **Phase B (Cleanup)**: Sequential only
- **Phase C (Foundation)**: Sequential only
- **Phase D (Themes)**: Safe bounded parallel (Blocked until C)
- **Phase E (Blocks)**: Safe bounded parallel (Blocked until C)
- **Phase F (Publish)**: Sequential only (Blocked until D & E)
- **Phase G (Shell)**: Safe bounded parallel (Blocked until E)
- **Phase H (Pages)**: Sequential only (Blocked until F & G)
- **Phase I (Widgets)**: Sequential only (Blocked until H)
- **Phase J & K (Handoff)**: Sequential only

*Autonomy Rules*: Implementers may autonomously create sub-components within a Phase's boundary. They may NOT autonomously alter schemas affecting downstream Phases without triggering a Gate 1/2 Architecture Review.

---

## 4. HANDOFF CONTRACT TO GEMINI VALIDATION

Before Gemini begins independent validation (Gate 5), `Claude`/`Codex` handoff must explicitly include the following in the notification:

1. **Completed Requirement IDs**: Explicit list mapped 1:1 against `SPEC-004`.
2. **Exact Test IDs Executed**: Explicit list mapped 1:1 against `TEST-004`.
3. **Exact Branch and Commit**: Hash of the exact code point to check out and validate against natively (e.g. `[branch name] - [commit hash]`).
4. **Visual Evidence Package**: Screenshots covering every UI constraint (e.g., Swatch toggle, Where-used trap, Draft/Prod toggle).
5. **Strapi Persistence Evidence**: Raw JSON exports of the Strapi entities generated for Theme, Block, Page, and Shell, ensuring no malformed DB entries.
6. **Exact Routes / Workflows Covered**: List of all Next.js routes modified or created.
7. **Studio Settings Used**: Documented `.env` flags and settings, specifically declaring the `fidelity-threshold` mode used during dev testing.
8. **Baseline Execution**: Explicit confirmation of whether the `docs/testing-artifacts/code.html` benchmark ingestion was executed.
9. **Known Limitations / Residual Gaps**: Transparent logging of any minor edge cases left incomplete.

*Failure to provide any of the above will result in immediate Gate 5 rejection (Return to Gate 4).*

---

## 5. ISSUE RETURN LOOP

Gemini will not fix implementation bugs. Gemini will validate, identifying failures, and use the exact format below to return execution to `Claude`/`Codex` (Gate 6):

```markdown
### Issue ID: [G-001]
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

Implementers must address the exact Issue ID, re-run local tests, and return the Issue ID with resolution details to Gemini for re-verification.

---

## 6. IMPLEMENTATION GUARDRAILS

**CRITICAL RULES IMPLEMENTERS MUST NOT VIOLATE:**
1. **NO Standalone Action Mappings (`REQ-BLK-02` / `ADR-004`)**: Action mapping routes must integrate internally into Block UX. Standalone routes from older iterations must be destroyed resulting in HTTP 404s.
2. **NO Magic Pages (`REQ-PAG-01`)**: Pages generate strictly via Block composition. Full HTML imports create Blocks natively inside the Strapi DB; they never map to new active Next.js implicit URL Slugs. 
3. **NO Swatch Publishing (`REQ-PUB-01`)**: The final verification publish overlay MUST reference the DB Active Production Theme explicitly, completely ignoring browser-level preview Swatches.
4. **NO JS Upload Execution (`REQ-WID-01` / `ADR-004`)**: Widgets execute strictly via trusted repo-paths (`/components/widgets/...`). Uploaded JS/HTML strings are for visual mocking mapping only and must trigger a hard sandbox block logic check on attempted eval.
5. **Fidelity Gate Rules (`REQ-PUB-02`)**: The fidelity threshold engine must strictly support and acknowledge both configuration modes (`allow-below-threshold` vs `disallow-below-threshold`). Disallow mode is a HARD gate interrupting the publish commit logic securely.
6. **NO Scope Expansion (`REQ-GOV-01`)**: If a feature is not explicitly in `SPEC-004` or an approved `ADR`, it is out of scope. Reject all "nice-to-have" IDE auto-suggestions aggressively.
7. **Preview-Only Swatches (`REQ-THM-02`)**: Theme swatch exists as preview-only visually inside the DOM, never bypassing to Strapi `PUT/POST` updates.

---

## 7. RECOMMENDED FIRST IMPLEMENTATION SLICE

**Target:** Phase B (Cleanup + Test Baseline) + Phase C (Shared/Reusable Workflow Foundation)
**Why?** 
1. The mandatory `TV-E2E-01` baseline test requires a sterile DB. Getting the wipe script working (Phase B) establishes a clean slate for all future UI work.
2. Building the generic list/detail container (`REQ-STU-01` in Phase C) immediately de-risks Themes, Blocks, and Shells. 
3. This is a low-logic, high-structure baseline that sets the application rules without wrestling with Strapi schema complexity.

Once Phase B & C are validated locally, the parallel execution of Blocks, Themes, and Shells can proceed rapidly at lower risk.

---

## 8. VALIDATION READINESS CHECKLIST

**For Gemini (Validator) to confirm readiness for Gate 5, the following MUST be explicitly provided by the implementer:**
- [ ] `PROOF-004` artifact draft is updated with implementation evidence.
- [ ] Exact branch/commit is declared for validation.
- [ ] Settings/config mode is explicitly declared (e.g., `allow-below-threshold`).
- [ ] Validator scope declaration is complete (i.e. what specifically should be evaluated).
- [ ] Known limitations / residual gaps are natively listed to avoid false-positive bug reports.
- [ ] Evidence package is complete (Visual screenshots + JSON Strapi dumps mapped to tests).
- [ ] Required implementation-side tests (Unit/E2E) are complete and locally passing.

If any box is unchecked, Gemini must reject Gate 4 exit and assign missing evidence issues back to the implementer without proceeding to validation.
