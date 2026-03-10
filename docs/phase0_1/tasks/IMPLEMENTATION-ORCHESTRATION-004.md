# IMPLEMENTATION ORCHESTRATION PACK
**Target:** Studio Workflow Tightening (Phase 0.1)
**Orchestrator:** Gemini
**Execution Agents:** Claude, Codex

## 1. EXECUTION SEQUENCE

The implementation of `SPEC-004` must be executed rigidly in the following sequence to prevent cascading dependency failures and ensure testability.

### Phase A: Control-Point and Setup Alignment
- **Purpose**: Establish baseline environment, align architecture guardrails, and prepare testing harnesses.
- **Requirement IDs**: N/A (Architecture & Environment setup)
- **Why order is mandatory**: Cannot build workflow routes without standard environment assumptions.
- **Entry Criteria**: Gate 2 complete. Intake, Specs, Tests approved.
- **Exit Criteria**: Developer environment running locally; Next.js and Strapi running without errors.
- **Blockers**: Pending DB migrations or missing `.env` variables.
- **Outputs**: Local environments active.

### Phase B: Shared/Reusable Workflow Foundation
- **Purpose**: Implement the global UI patterns (List/Detail/Action Menus) that all subsequent workflows will inherit.
- **Requirement IDs**: `REQ-STU-01`
- **Why order is mandatory**: Theme, Block, and Shell workflows require these containers to render properly without UI fragmentation.
- **Entry Criteria**: Phase A complete.
- **Exit Criteria**: Shared UI components exist in the repository and are imported successfully in at least one mockup route. 
- **Blockers**: None.
- **Outputs**: Reusable React components for Block/Page/Theme listings.

### Phase C: Theme Workflow
- **Purpose**: Enable bounded upload of themes, rendering of swatches vs active states, and trap duplicate keys.
- **Requirement IDs**: `REQ-THM-01`, `REQ-THM-02`, `REQ-THM-03`
- **Why order is mandatory**: Blocks and Pages need styling context to render previews.
- **Entry Criteria**: Phase B complete.
- **Exit Criteria**: Can upload a theme, reject bad MIME types, preview a swatch without altering active state, and trigger the duplicate trap.
- **Blockers**: Shared list components from Phase B must be ready.
- **Outputs**: `/themes` route complete. Theme logic isolated in Strapi.

### Phase D: Block Workflow
- **Purpose**: Implement Block ingestion, rendering fallbacks, and generic action mapping embedded in block workflows.
- **Requirement IDs**: `REQ-BLK-01`, `REQ-BLK-02`, `REQ-BLK-03`
- **Why order is mandatory**: Blocks are the atomic units of Pages. Pages cannot be built without Blocks.
- **Entry Criteria**: Phase C complete.
- **Exit Criteria**: Blocks can be browsed. Deletion dependency check prevents orphan maps. Standalone action mapping routes deleted/404'd. Tailward fallbacks render without CDN.
- **Blockers**: DB Schema for blocks and action mappings must be finalized.
- **Outputs**: `/blocks` route complete. Where-used logic active.

### Phase E: Publish / Fidelity Behavior
- **Purpose**: Enforce WYSIWYG guarantees and fidelity threshold rules before Pages and global states can be published.
- **Requirement IDs**: `REQ-PUB-01`, `REQ-PUB-02`
- **Why order is mandatory**: Publish logic must govern how Shell and Page workflows save their final states.
- **Entry Criteria**: Phases C & D complete (Themes & Blocks exist to be published).
- **Exit Criteria**: Publish ignores swatches entirely. Fidelity calculator logs warnings in 'allow' mode and hard-blocks in 'disallow' mode on dark mode inversion.
- **Blockers**: Theme architecture must separate Active vs Swatch securely.
- **Outputs**: Global Studio Fidelity Setting toggle. Verification Publish overlay component.

### Phase F: Shell Workflow
- **Purpose**: Global app configuration (Navbar/Footer) utilizing the shared Phase B components and Phase D Block schemas.
- **Requirement IDs**: `REQ-SHL-01`
- **Why order is mandatory**: Shell configures the global wrapper that Pages will render inside.
- **Entry Criteria**: Phase B & Phase D complete.
- **Exit Criteria**: Shell UI maps Navbar/Footer globally.
- **Blockers**: None.
- **Outputs**: Shell configuration UI and DB state updates.

### Phase G: Page Workflow
- **Purpose**: Assemble Blocks into coherent route Pages. Ensure HTML import yields blocks and no implicit slugs. Draft/Prod visual parity.
- **Requirement IDs**: `REQ-PAG-01`, `REQ-PAG-02`
- **Why order is mandatory**: Requires Blocks (Phase D), Themes (Phase C), and Publish guarantees (Phase E).
- **Entry Criteria**: Phase E complete.
- **Exit Criteria**: Full HTML upload creates exactly 0 slugs and X blocks. Draft vs Prod modes toggle accurately.
- **Blockers**: Theme swatch integration and Block extractors must exist.
- **Outputs**: `/pages` route complete.

### Phase H: Widget Workflow
- **Purpose**: Securely embed logic inside Blocks/Pages using repo-first approach. 
- **Requirement IDs**: `REQ-WID-01`
- **Why order is mandatory**: Widgets inject into Pages and Blocks, so those structures must exist first.
- **Entry Criteria**: Phase G complete.
- **Exit Criteria**: Repo-mapped widget logic acts on UI. Raw HTML `<script>` ingest is rejected.
- **Blockers**: Page assembly must be stable to test Widget interaction.
- **Outputs**: Widget placement module. Rejected sanitization rules.

### Phase I: Cleanup + Test Baseline
- **Purpose**: Ensure test harnesses start from a sterile DB.
- **Requirement IDs**: `REQ-CLN-01`
- **Why order is mandatory**: Need all features implemented to baseline the Database correctly.
- **Entry Criteria**: Phases A-H code complete.
- **Exit Criteria**: Database drops legacy `faq`/`hero` and maintains sterile state before test sequence.
- **Blockers**: None.
- **Outputs**: DB wipe script or test harness hook.

### Phase J: Implementation-Side Unit and E2E Test Completion
- **Purpose**: Local verification by Claude/Codex (Gate 3/4).
- **Why order is mandatory**: Developers must prove local stability before independent validation.
- **Entry Criteria**: All code implementation (Phases A-I).
- **Exit Criteria**: Local unit tests pass. Local E2E tests execute without crash.
- **Outputs**: Test logs demonstrating no runtime exceptions.

### Phase K: Gemini Validation Handoff
- **Purpose**: Shift from implementation to independent validation (Gate 5).
- **Why order is mandatory**: Final step of implementation orbit.
- **Entry Criteria**: Phase J complete.
- **Exit Criteria**: Implementation proof drafted, Gemini invoked for validation.
- **Outputs**: Ready-for-validation ping to Gemini along with `PROOF` document references.

---

## 2. CLAUDE/CODEX IMPLEMENTATION INSTRUCTION PACK

### Phase A-B (Foundation)
- **Scope Boundary**: Build common UI layouts, setup active dev env. 
- **Files/Docs to Obey**: `SPEC-004`, `ARCHITECTURE.md`.
- **Requirements Satisfied**: `REQ-STU-01`.
- **What not to change**: Do not build the logic for specific entities yet. Only layout containers.
- **Implementation Expectations**: Highly reusable layout components for list/detail.
- **Tests**: Snapshot or render unit tests for UI containers.
- **Evidence Required**: Screenshots of empty state UI containers.

### Phase C (Theme)
- **Scope Boundary**: `/themes` route, Strapi theme entity logic, swatch capability.
- **Files/Docs to Obey**: `SPEC-004`.
- **Requirements Satisfied**: `REQ-THM-01`, `REQ-THM-02`, `REQ-THM-03`.
- **What not to change**: Active production DB records when swatching.
- **Implementation Expectations**: Strict MIME checking, swatch-only previews, graceful error catch on duplicate keys.
- **Tests**: Unit tests for MIME upload rejection and duplicate error traps.
- **Evidence Required**: Screenshot of swatch applied vs active theme.

### Phase D (Block)
- **Scope Boundary**: `/blocks` route, block fallback styling, action mapping integration, where-used API.
- **Files/Docs to Obey**: `SPEC-004`.
- **Requirements Satisfied**: `REQ-BLK-01`, `REQ-BLK-02`, `REQ-BLK-03`.
- **What not to change**: Do not rewrite Tailwind base config, just utilize structural defaults.
- **Implementation Expectations**: 404 existing standalone Action map routes. Bind action mapping entirely into block details.
- **Tests**: Mock CDN failure to assert Tailwind fallback rendering.
- **Evidence Required**: "Where-used" rejection modal screenshot for deletion attempt.

### Phase E (Publish Behavior)
- **Scope Boundary**: Publish modal, Fidelity configuration toggle system.
- **Files/Docs to Obey**: `SPEC-004`.
- **Requirements Satisfied**: `REQ-PUB-01`, `REQ-PUB-02`.
- **What not to change**: Swatch UI state; publish strictly fetches Active state from DB.
- **Implementation Expectations**: Two strict modes (Allow/Disallow). Verify specifically on `@media(dark)` inversions.
- **Tests**: Logic tests asserting threshold calculation block behavior in 'disallow' mode.
- **Evidence Required**: Log outputs of threshold engine warning vs blocking.

### Phase F (Shell)
- **Scope Boundary**: `/shell` route mapping.
- **Files/Docs to Obey**: `SPEC-004`.
- **Requirements Satisfied**: `REQ-SHL-01`.
- **What not to change**: Global tenancy scope (No tenant-specific logic).
- **Implementation Expectations**: Mirror block logic for Navbar/Footer.
- **Tests**: Global render assertion on shell update.
- **Evidence Required**: UI Screenshot showing configured Shell mapping.

### Phase G (Page)
- **Scope Boundary**: `/pages` route, HTML ingestion extractor.
- **Files/Docs to Obey**: `SPEC-004`.
- **Requirements Satisfied**: `REQ-PAG-01`, `REQ-PAG-02`.
- **What not to change**: HTML ingest must NOT create slugs.
- **Implementation Expectations**: Block composition only. Draft vs Prod view states. 
- **Tests**: E2E simulation of HTML ingest confirming 0 slugs created.
- **Evidence Required**: Strapi DB query showing extracted blocks but NO new page slugs.

### Phase H (Widget)
- **Scope Boundary**: Widget onboarding via local repo paths.
- **Files/Docs to Obey**: `SPEC-004`.
- **Requirements Satisfied**: `REQ-WID-01`.
- **What not to change**: Do not execute uploaded `.js`. Only path-based (`/components/widgets/...`) code executes.
- **Implementation Expectations**: Hard rejection of `<script>` upload. Visual fallback mapping to studio blocks.
- **Tests**: Unit test rejecting script upload.
- **Evidence Required**: Functional execution record of widget within block.

### Phase I-K (Handoff)
- **Instructions**: Run your local E2E loops. Populate your portion of the Proof documentation. Ensure the DB is sterile. Assign Issue return loops to yourselves. Handoff to Gemini.

---

## 3. PARALLELISM / AUTONOMY PLAN

Implementers have tight autonomy within defined phases but cross-phase execution is rigidly controlled.

- **Strictly Sequential (No Parallelism)**:
  - Phase A $\rightarrow$ Phase B (Foundation first)
  - Phase E $\rightarrow$ Phase G (Publish controls needed before Pages deploy)

- **Safe Parallel Work**: 
  - Phase C (Themes), Phase D (Blocks), and Phase F (Shell) can be executed **IN PARALLEL** once Phase B (Foundation UI) is complete. They deal with distinct architectural domains but share generic UI dependencies.

- **Risky Parallel Work**:
  - Phase H (Widget) and Phase D (Block) should NOT happen in parallel. Widgets embed inside Blocks. Blocks must be stable first. 

*Autonomy Rules*: Implementers may autonomously create sub-components within a Phase's boundary. They may NOT autonomously alter schemas affecting downstream Phases without triggering a Gate 1/2 Architecture Review.

---

## 4. HANDOFF CONTRACT TO GEMINI VALIDATION

To close Gate 4 and trigger Gate 5, `Claude`/`Codex` must provide the following explicitly to the `Gemini` Validator:

1. **Completed REQ IDs list**: Must map 1:1 against `SPEC-004`.
2. **Local Test Results**: Pass logs for Unit Tests and local Implementer E2E execution tests demonstrating no crashes.
3. **Persistence Evidence**: Raw JSON exports of the Strapi entities generated for Theme, Block, and Page ensuring no malformed DB entries.
4. **Visual Evidence**: Screenshots of every UI constraint mentioned in the Requirement blocks (e.g., Swatch toggle, Where-used trap).
5. **Branch Details**: Exact `git commit` hash to be pulled and validated against by Gemini.
6. **Feature Flags**: Explicit list of configuration toggles to set (e.g., `STUDIO_FIDELITY_MODE=allow-below-threshold`).

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
1. **NO Standalone Action Mappings**: Action mapping routes must integrate internally into Block UX. Standalone routes must be destroyed.
2. **NO Magic Pages**: Pages generate strictly via Block composition. Full HTML imports create Blocks, never Pages. 
3. **NO Swatch Publishing**: The final verification publish overlay MUST reference the Active Production Theme, completely ignoring preview Swatches.
4. **NO JS Upload Execution**: Widgets execute strictly via trusted repo-paths. Uploaded JS/HTML is for visual mocking only.
5. **NO Scope Expansion**: If a feature is not in `SPEC-004`, it is out of scope. Reject "nice-to-have" IDE auto-suggestions.
6. **Fidelity Gate**: Disallow mode for Fidelity is a HARD gate. It must actively block the UX publish state.

---

## 7. RECOMMENDED FIRST IMPLEMENTATION SLICE

**Target:** Phase B (Shared Reusable UI Containers) + Phase I (Cleanup DB Baseline)
**Why?** 
1. The mandatory `TV-E2E-01` baseline test requires a sterile DB. Getting the wipe script working establishes a clean slate for all future UI work.
2. Building the generic list/detail container (`REQ-STU-01`) immediately de-risks Phase C, D, and F. 
3. This is a low-logic, high-structure task that establishes the baseline codebase pattern without wrestling with Strapi schema complexity.

Once Phase B is validated, the parallel execution of Blocks, Themes, and Shells can proceed rapidly at lower risk.

---

## 8. VALIDATION READINESS CHECKLIST

**For Gemini (Validator) to confirm readiness for Gate 5:**
- [ ] Implementer has confirmed all `REQ-*` IDs are developed.
- [ ] Implementer has provided local Unit and E2E unit test pass logs.
- [ ] Implementer has provided DB persistence JSON logs.
- [ ] Implementer has provided Screenshots for UI traps/modals.
- [ ] Branch is committed, clean, and merged to the testing environment.
- [ ] Development Environment variables/toggles are documented.
- [ ] `TV-E2E-01` cleanup script is confirmed functional to prepare environment for validation pass.

If any box is unchecked, Gemini must reject Gate 4 exit and assign missing evidence issues back to the implementer.
