# IMPLEMENTATION HANDOFF - SLICE 1
**Target:** Studio Workflow Tightening (Phase 0.1)
**Orchestrator:** Gemini
**Execution Agents:** Claude, Codex

---

## 1. CURRENT EXECUTION POSITION

**Status:** Governance and Orchestration are LOCKED.
**Next Action:** Begin the first Implementation Slice.

**Exact First Implementation Slice:**
We are beginning with **Phase B (Cleanup + Test Baseline)** followed directly by **Phase C (Shared/Reusable Workflow Foundation)** exactly as defined in `IMPLEMENTATION-ORCHESTRATION-004.md`.

**Why this slice is first:**
1. Phase B establishes the mandatory sterile Database environment required for `TV-E2E-01`. Without this, no subsequent end-to-end testing can be trusted.
2. Phase C mandates the creation of the generic List/Detail/Action UI structures (`REQ-STU-01`). Every other route (Themes, Blocks, Shell, Pages) relies on these components. Building them now de-risks all parallel downstream logic.

**What must be completed before the next slice starts:**
This handoff must be fully coded, locally unit tested, successfully executed against `TV-E2E-01`, and returned to Gemini using the strict Implementation Return Format with explicitly passing DB sterile-state logs before Phase D, E, or G can be authorized.

---

## 2. FIRST HANDOFF TO CLAUDE/CODEX (H-001)

### 2.1. OPERATOR ROUTING NOTE
- **Intended Recipient**: Claude/Codex
- **Purpose**: Wipe legacy Strapi entries to prepare the test harness, and build the shared UI containers all Studio workflows will inherit.
- **Handoff Type**: Mixed (Implementation + Implementation-Side Testing)
- **Execution Mode**: Autonomous within bounded slice ONLY.
- **Scope Authorization**: Authorizes Phase B and Phase C exactly. Later phases are explicitly NOT authorized.

### 2.2. IMPLEMENTER HANDOFF BODY
**ATTENTION CLAUDE/CODEX:**
You are now authorized to begin Implementation Handoff H-001.

- **Handoff ID**: `H-001`
- **Phases Covered**: Phase B (Cleanup + Test Baseline) & Phase C (Shared/Reusable Workflow Foundation)
- **Purpose**: Wipe legacy Strapi entries to prepare the test harness, and build the shared UI containers all Studio workflows will inherit.
- **Exact Requirement IDs**: `REQ-CLN-01`, `REQ-STU-01`
- **Exact Governing Docs to Obey**: 
  - `docs/phase0_1/specs/SPEC-004-studio-workflow-tightening.md`
  - `docs/phase0_1/tasks/IMPLEMENTATION-ORCHESTRATION-004.md`
  - `docs/phase0_1/tests/TEST-004-studio-workflow-tightening.md`
- **Scope Boundary**: 
  - *Phase B*: Create a script/hook capable of purging legacy `faq`/`hero` blocks from the database to establish a sterile test state.
  - *Phase C*: Build generalized React UI container patterns for `List`, `Detail`, and `Action Menu` mimicking current design standards but uncoupled from specific block data.
- **Explicit Non-Goals (Do Not Do These)**: 
  - Do not drop core structural Strapi tables (only content rows).
  - Do not map the UI components to live Next.js routes yet.
  - Do not build Theme/Block/Page specific API logic.
- **Implementation Tasks to Complete**:
  1. Write the DB wipe utility.
  2. Implement the shared UI React components.
  3. Render the generic UI components in a mock/test route to verify compilation.
- **Unit Tests Required**: Snapshot or render unit tests verifying the generic UI containers load without crashing in an empty state.
- **Implementation-Side E2E Tests Required**: Execute `TV-E2E-01` locally ensuring the DB wipe utility functions perfectly against the local Strapi instance.
- **Evidence Package Required Before Return**:
  - Strapi DB JSON query output confirming a sterile state after the wipe script runs.
  - Screenshots of the generic UI containers rendering perfectly in their empty state.
- **Branch/Commit Expectation**: A precise commit hash pushed to the designated development branch (`ui-workflow-studio-complete`).
- **Settings/Configurations**: Explicitly declare any required `.env` flags used for the wipe script.
- **Blockers for Escalation**: Stop and escalate to Gemini if the DB wipe script threatens unintended tables or if the generic UI component architecture requires modifying the global Tailwind configuration beyond structural defaults.

---

## 3. EXECUTION ORDER AFTER FIRST HANDOFF

Once `H-001` completes successfully, the execution unlocks:

1. **Phase D (Theme Workflow)** - *Safe bounded parallel*
   - **Why next**: Gives blocks/pages styling context.
   - **Prior Evidence Needed**: Phase C UI components must exist to wrap theme lists.
2. **Phase E (Block Workflow)** - *Safe bounded parallel*
   - **Why next**: Atomic unit of the page system.
   - **Prior Evidence Needed**: Phase C UI components must exist for the Block browse view.
3. **Phase G (Shell Workflow)** - *Safe bounded parallel*
   - **Why next**: Wraps the global mapping.
   - **Prior Evidence Needed**: Phase E Block states must exist to map shell components.

---

## 4. HANDOFF TEMPLATE FOR SUBSEQUENT PHASES

When Gemini issues the next phases, this exact template will be used:

### 4.1. OPERATOR ROUTING NOTE
- **Intended Recipient**: [Claude / Codex / Claude/Codex / Gemini Validator]
- **Purpose**: [Purpose of the handoff]
- **Handoff Type**: [Implementation / Testing / Mixed / Validation]
- **Execution Mode**: [Autonomous within bounded slice / Human-routed]
- **Scope Authorization**: [Phase X only. Later phases are explicitly NOT authorized.]

### 4.2. IMPLEMENTER HANDOFF BODY
**ATTENTION [CLAUDE / CODEX / CLAUDE/CODEX / GEMINI]:**
You are now authorized to execute this bounded handoff.

- **Handoff ID**: `H-XXX`
- **Phase Covered**: [Phase Name]
- **Requirement IDs**: [REQ-XXX-XX]
- **Governing Docs**: [SPEC / TASK / ADR references]
- **Entry Criteria**: [Requirements that must be verified before starting this task]
- **Scope Boundary**: [Explicit bounds of what to build]
- **Explicit Non-Goals**: [What NOT to touch or build]
- **Required Implementation Tasks**:
  1. [Task 1]
  2. [Task 2]
- **Required Tests**: [Specific TV-MTR or TV-E2E tests to pass locally]
- **Required Evidence**: [Exact JSON, Screenshot, or log requirements to clear the Gate]
- **Return Condition**: [When to hand back to Gemini]
- **Escalation Condition**: [When to STOP and ask Gemini rather than guessing]
```

---

## 5. ESCALATION RULES

**Claude/Codex MUST stop coding and return to Gemini if any of the following occur:**
- **Requirement Ambiguity**: The `SPEC-004` text is unclear on a boundary or expected behavior.
- **Governance Conflict**: Implementing the feature requires violating a rule in `IMPLEMENTATION-ORCHESTRATION-004.md` (e.g. finding that Action Mappings *do* need a standalone route to function).
- **Missing Dependency**: A Phase explicitly blocked by another Phase lacks the exported components or DB Schema to proceed.
- **Architecture Drift Risk**: Solving the engineering problem requires a new dependency, a Next.js routing overhaul, or altering `ARCHITECTURE.md`.
- **Failed Prerequisite**: A prior Gate test (like `TV-E2E-01`) fails unexpectedly in the local environment.
- **Need for Scope Expansion**: An IDE auto-suggestion or "nice to have" feature seems logical but lacks an explicit `REQ-` ID.
- **Inability to Satisfy Proof**: Cannot generate the exact screenshots or JSON logs demanded in the Handoff Evidence section.

---

## 6. IMPLEMENTATION RETURN FORMAT

When Claude/Codex finishes a given handoff slice, they must return control to Gemini using this exact strict markdown format:

```markdown
### IMPLEMENTATION RETURN [Handoff ID: H-001]
- **Branch Name**: [exact branch]
- **Commit Hash**: [full git SHA]
- **Requirement IDs Completed**: [REQ-XXX-XX, ...]
- **Files Changed**: [List of specific structural files altered]
- **Test IDs Executed Locally**: [TV-E2E-XX, TV-MTR-XX]
- **Test Results**: [PASS/FAIL summary]
- **Evidence Summary**: [Links/attachments to Screenshots & JSON logs]
- **Strapi Persistence Evidence**: [Confirmation of sterile DB or specific entity JSON outputs]
- **Settings Used**: [Any env flags, e.g. STUDIO_FIDELITY_MODE=...]
- **Known Limitations**: [Zero defect assumption, or explicitly list minor accepted UI quirks]
- **Ready for Gemini Validation**: [YES / NO]
```

---

## 7. GEMINI CONTROL LOOP

As the Requirements Orchestrator, Gemini will manage the implementation flow via the following rigid loop:

1. **Issue Handoff**: Provide the exact sliced instruction block to Claude/Codex.
2. **Wait**: Enter standby until the structured Implementation Return Format is provided.
3. **Verify Completeness**: Cross-check the returned Evidence Summary against the demanded obligations.
4. **Reject on Gaps**: If Claude/Codex omits screenshots, persistence logs, or commits to an arbitrary branch, REJECT the handoff and demand the missing artifacts before proceeding.
5. **Queue Next Slice**: Only once the entry criteria and evidence match perfectly will Gemini issue the next bounded handoff template (e.g. `H-002: Themes & Blocks`).
6. **Trigger Validation Gate**: Send completed slices to the formal Independent Validation Gate at the exact scheduled checkpoints (see Section 8).
7. **Assign Defects**: If Independent Validation finds drift, use the Issue Task Assignment format (`G-00X`) to return defects to Claude/Codex.

---

## 8. FIRST VALIDATION GATE PREVIEW

**When should Gemini perform the first serious independent validation checkpoint?**
Independent validation bounds will be executed **after multiple slices (specifically tracking up through Phase E - Block Workflow)**.

**Why?**
Phase B (Wipe) and Phase C (UI Containers) lack enough Next.js routing implementation to trigger meaningful independent product validation. Validating an empty database and empty UI wrappers is redundant with the implementers' screenshot evidence.

The first critical integration risk occurs when **Themes (Phase D)** and **Blocks (Phase E)** intersect inside the new Generic UI routing. Therefore, Gemini's first deep independent validation gate occurs after the `H-002` (Themes & Blocks) handoff is returned, executing the `TV-E2E-02` (Ingestion) and checking for standard Tailwind fallbacks.
