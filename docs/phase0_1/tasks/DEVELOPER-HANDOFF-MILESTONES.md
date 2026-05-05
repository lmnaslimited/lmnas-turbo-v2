# Developer Handoff Milestones

## Purpose

This document is the outsourcing handoff checklist for taking LMNAs Studio from the current Phase 0.1 state to the end objective.

Original task requirement:

> Define deterministic milestones from the current repo state to the final product objective so external developers can execute the project without relying on chat history.

Product recovery requirement:

> An operator must be able to import a design source, generate reusable blocks, assemble a page, connect widget behavior, apply a shell/theme, preview the result, publish, and later reopen/edit through one simple, governed Studio experience.

## Governing References

External developers must read and follow these before implementation:

- `ARCHITECTURE.md`
- `docs/phase0_1/PHASE0_1_MASTER_PROMPT.md`
- `docs/phase0_1/WORKSTREAM.md`
- `docs/phase0_1/specs/SPEC-004-studio-workflow-tightening.md`
- `docs/phase0_1/tests/TEST-004-studio-workflow-tightening.md`
- `docs/phase0_1/proof/PROOF-004-studio-workflow-tightening.md`
- `docs/phase0_1/specs/lmnas_studio_product_recovery_spec_v_1.md`
- `docs/phase0_1/tasks/IMPLEMENTATION-ORCHESTRATION-007-product-recovery.md`
- `docs/platform/onboarding-workflow.md`
- `docs/platform/exit-architecture.md`

## Current State

As of this handoff:

- Phase 0.1 technical foundations exist.
- `PROOF-004` marks Gates 0-5, 8, and 9 closed.
- Gate 6 is open: first-class canonical studio settings are not complete.
- Gate 7 is partial: cross-workflow real-stack parity coverage is incomplete.
- H-007 product recovery is the next governing product objective.

## Non-Negotiable Rules

- Do not implement any Phase 0.1 feature without linked `INT`, `SPEC`, `TASK`, `PROOF`, and, when needed, `ADR` artifacts.
- Blocks must remain schema-first pure UI.
- CTA behavior must route through `ActionBinding`.
- Workflow and integration behavior must route through `ExitDefinition` and adapters.
- n8n remains the orchestration center.
- Rudder remains the event stream.
- Do not expose raw JSON payloads as the primary operator UX.
- Do not create implicit active page slugs from import.
- Do not execute arbitrary uploaded JavaScript.
- Screenshots alone do not close a milestone; executable command logs and persisted JSON/API evidence are required.

## Milestone Checklist

### M0 - Handoff Baseline

Requirement source:

- Original outsourcing handoff requirement
- `docs/phase0_1/WORKSTREAM.md`
- `docs/phase0_1/proof/PROOF-004-studio-workflow-tightening.md`

Developer tasks:

- [ ] Install dependencies.
- [ ] Boot the local app and required services.
- [ ] Run baseline checks and record exact results.
- [ ] Confirm current open gates: Gate 6 and Gate 7.
- [ ] Document known failures before new implementation starts.

Validation commands:

- [ ] `npm install`
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`

Exit evidence:

- [ ] Setup notes.
- [ ] Command results.
- [ ] Known blocker list.

### M1 - RR Governance Lock

Requirement source:

- `docs/phase0_1/PHASE0_1_MASTER_PROMPT.md`
- `docs/phase0_1/specs/lmnas_studio_product_recovery_spec_v_1.md`

Developer tasks:

- [ ] Create or update the RR artifact chain for the next implementation feature.
- [ ] Ensure every developer task maps to an acceptance criterion.
- [ ] Ensure every implementation file path is listed in the task doc before coding.
- [ ] Run the Phase 0.1 guard for the selected ID.

Validation command:

- [ ] `pnpm phase0:guard -- --id <ID>`

Exit evidence:

- [ ] `INT-<ID>` exists.
- [ ] `SPEC-<ID>` exists and links Intake.
- [ ] `TASK-<ID>` exists and links Spec.
- [ ] `PROOF-<ID>` exists and links Spec.
- [ ] `ADR-<ID>` exists if an architectural decision is required.
- [ ] Guard passes.

### M2 - Close Gate 6: Canonical Studio Settings

Requirement source:

- `PROOF-004` Gate 6 blocker
- `SPEC-004`
- `TEST-004`

Developer tasks:

- [ ] Move fidelity mode and threshold out of `themeDebt`.
- [ ] Persist studio settings through a first-class canonical settings path.
- [ ] Update publish logic to read canonical settings.
- [ ] Add tests proving settings persistence is independent of theme debt.
- [ ] Update proof with exact command results.

Likely files:

- `apps/site/app/api/platform/studio/settings/route.ts`
- `apps/site/app/api/platform/studio/publish/route.ts`
- `apps/site/app/api/platform/studio/_lib/canonical-settings.ts`
- `apps/site/app/api/platform/studio/_lib/store.ts`
- `apps/site/app/api/platform/studio/_lib/strapi.ts`

Exit evidence:

- [ ] Gate 6 marked closed in proof.
- [ ] Unit/API tests pass.
- [ ] Persisted settings JSON evidence is attached or referenced.
- [ ] Publish route no longer resolves fidelity settings from `themeDebt`.

### M3 - Close Gate 7: Cross-Workflow Parity Coverage

Requirement source:

- `PROOF-004` Gate 7 blocker
- `TEST-004`
- `docs/platform/onboarding-workflow.md`

Developer tasks:

- [ ] Add real-stack coverage for Theme create, rename, edit, preview, activate, reopen.
- [ ] Add real-stack coverage for Shell menu edit, activate, reopen.
- [ ] Add real-stack coverage for Widget action parity and reopen/edit behavior.
- [ ] Add real-stack coverage for Page rename, menu parity, preview, publish, reopen.
- [ ] Ensure shared list/detail/action-menu patterns behave consistently.

Likely files:

- `apps/site/e2e/studio-workflows.spec.ts`
- `apps/site/e2e/onboarding.visual.spec.ts`
- `apps/site/app/platform/onboarding/theme/page.tsx`
- `apps/site/app/platform/onboarding/shells/page.tsx`
- `apps/site/app/platform/onboarding/widgets/page.tsx`
- `apps/site/app/platform/onboarding/pages/page.tsx`

Exit evidence:

- [ ] Gate 7 marked closed in proof.
- [ ] Playwright command logs recorded.
- [ ] API/persistence evidence recorded for each workflow.

### M4 - Unified Studio UX Recovery

Requirement source:

- `docs/phase0_1/specs/lmnas_studio_product_recovery_spec_v_1.md`
- `docs/phase0_1/tasks/IMPLEMENTATION-ORCHESTRATION-007-product-recovery.md`
- `TEST-004` / `TV-E2E-07`

Developer tasks:

- [ ] Reorganize Studio around operator tasks, not implementation phases.
- [ ] Provide clear navigation for Import, Blocks, Pages, Widgets/Actions, Shell/Theme, and Publish.
- [ ] Use the same interaction grammar across object types: list, open, create, edit, duplicate, delete, preview, apply/save/publish.
- [ ] Hide technical IDs and raw payloads from the primary UX.
- [ ] Preserve all existing governance and safety boundaries.

Primary route:

- `apps/site/app/platform/onboarding`

Exit evidence:

- [ ] Operator can identify the correct next step without developer explanation.
- [ ] No primary workflow depends on raw JSON editing.
- [ ] Existing safety tests still pass.

### M5 - Import Studio

Requirement source:

- Product Recovery Spec sections 5 and 6.1
- `TEST-004` / `TV-E2E-02`

Developer tasks:

- [ ] Support clean source intake for URL, raw HTML, and available Figma/Stitch-derived exports.
- [ ] Show simple progress and status messaging.
- [ ] Present a structured proposal instead of raw ingestion output.
- [ ] Propose theme signals, shell signals, page candidate, extracted blocks, and widget/action hooks.
- [ ] Prevent import from creating active page slugs automatically.

Likely files:

- `apps/site/app/platform/onboarding/import/page.tsx`
- `apps/site/app/api/platform/onboarding/analyze/route.ts`
- `apps/site/app/api/platform/studio/import/process/route.ts`
- `packages/integrations/src/onboarding/*`

Exit evidence:

- [ ] `TV-E2E-02` passes.
- [ ] Ingestion output proves blocks/entities were proposed or created as governed objects.
- [ ] Evidence proves zero active page slugs were implicitly created.

### M6 - Structure Review And Block Normalization

Requirement source:

- Product Recovery Spec sections 5, 6.2
- `TEST-004` / `TV-MTR-03`, `TV-MTR-04`, `TV-MTR-05`

Developer tasks:

- [ ] Let operator accept proposed blocks.
- [ ] Let operator rename blocks.
- [ ] Let operator merge duplicates where supported by the approved schema.
- [ ] Let operator discard junk extraction.
- [ ] Let operator create a manual block.
- [ ] Show block preview and where-used status.
- [ ] Block deletion must be blocked when the block is used by an active page.

Likely files:

- `apps/site/app/platform/onboarding/blocks/page.tsx`
- `apps/site/app/api/platform/studio/blocks/route.ts`
- `apps/site/app/api/platform/studio/blocks/publish/route.ts`
- `packages/blocks/*`
- `packages/block-registry/src/index.ts`

Exit evidence:

- [ ] Block library persists approved blocks.
- [ ] Where-used rejection evidence exists.
- [ ] Fallback rendering evidence exists.
- [ ] Blocks remain schema-first with fixture and tests.

### M7 - Page Composer

Requirement source:

- Product Recovery Spec sections 5, 6.3
- `TEST-004` / `TV-E2E-04`, `TV-MTR-09`

Developer tasks:

- [ ] Create/open page from the Studio UI.
- [ ] Assign or edit slug intentionally.
- [ ] Add, remove, reorder, replace, and duplicate blocks.
- [ ] Support first-class in-page content editing.
- [ ] Clearly distinguish reusable block edits from page-instance edits.
- [ ] Show draft/live status and applied shell/theme.

Likely files:

- `apps/site/app/platform/onboarding/pages/page.tsx`
- `apps/site/app/platform/onboarding/pages/preview/page.tsx`
- `apps/site/app/api/platform/studio/pages/route.ts`
- `apps/site/lib/studio-page-runtime.ts`
- `apps/site/lib/studio-runtime-page-view.tsx`

Exit evidence:

- [ ] `TV-E2E-04` passes.
- [ ] Page persists as canonical page structure.
- [ ] Draft/live preview behaves as specified.
- [ ] No implicit route slug is created by import.

### M8 - Widget Binding And Action Mapping

Requirement source:

- Product Recovery Spec sections 5, 6.4
- `docs/platform/exit-architecture.md`
- `TEST-004` / `TV-E2E-05`, `TV-MTR-10`

Developer tasks:

- [ ] Present only approved widgets.
- [ ] Attach and detach widget behavior to blocks, zones, or actions.
- [ ] Configure widgets using plain fields.
- [ ] Map actions such as CTA click, form submit, modal open, download, and workflow launch.
- [ ] Route business behavior through `ActionBinding`, `WidgetDefinition`, and `ExitDefinition`.
- [ ] Reject arbitrary uploaded JavaScript.
- [ ] Confirm valid repo-path widget behavior executes safely.

Likely files:

- `apps/site/app/platform/onboarding/widgets/page.tsx`
- `apps/site/app/api/platform/studio/widgets/route.ts`
- `apps/site/app/api/platform/studio/widgets/execute/route.ts`
- `apps/site/app/api/platform/exits/execute/route.ts`
- `packages/contracts/src/platform.contracts.ts`
- `packages/integrations/src/lens.ts`
- `services/n8n/workflows/*.json`

Exit evidence:

- [ ] Raw JS rejection log.
- [ ] Valid widget execution record.
- [ ] Exit/n8n payload evidence where applicable.

### M9 - Shell And Theme Manager

Requirement source:

- Product Recovery Spec sections 5, 6.5
- `docs/platform/onboarding-workflow.md`
- `TEST-004` / `TV-MTR-01`, `TV-MTR-02`, `TV-MTR-08`

Developer tasks:

- [ ] Show active shell and active theme clearly.
- [ ] Allow intentional shell/theme switching.
- [ ] Support preview-only swatches.
- [ ] Prevent swatch preview from mutating active production theme.
- [ ] Edit understandable theme controls without exposing raw token complexity by default.
- [ ] Ensure shell menu/footer/action changes apply globally.

Likely files:

- `apps/site/app/platform/onboarding/theme/page.tsx`
- `apps/site/app/platform/onboarding/shells/page.tsx`
- `apps/site/app/api/platform/studio/themes/route.ts`
- `apps/site/app/api/platform/studio/themes/activate/route.ts`
- `apps/site/app/api/platform/studio/shells/route.ts`
- `apps/site/app/api/platform/studio/shells/activate/route.ts`

Exit evidence:

- [ ] Swatch before/after evidence.
- [ ] Refresh proves preview swatch does not persist as active theme.
- [ ] Shell payload diff shows global mapping update.

### M10 - Preview And Publish Center

Requirement source:

- Product Recovery Spec sections 5, 6.6
- `TEST-004` / `TV-E2E-06`, `TV-MTR-06`, `TV-MTR-07`, `TV-MTR-11`

Developer tasks:

- [ ] Provide draft preview.
- [ ] Provide live preview.
- [ ] Show what is about to go live.
- [ ] Show fidelity report.
- [ ] Block publish when `disallow-below-threshold` fails.
- [ ] Permit warning-only publish when `allow-below-threshold` is configured.
- [ ] Ensure publish uses canonical active theme, not preview swatch.

Likely files:

- `apps/site/app/platform/onboarding/publish/page.tsx`
- `apps/site/app/platform/onboarding/publish/PublishOverlayWorkflow.tsx`
- `apps/site/app/api/platform/studio/publish/route.ts`
- `apps/site/app/api/platform/studio/_lib/fidelity.ts`

Exit evidence:

- [ ] Publish success/failure API logs.
- [ ] Fidelity threshold JSON output.
- [ ] Publish rejection evidence.
- [ ] Draft/live isolation evidence.

### M11 - Full Operator E2E Recovery

Requirement source:

- `docs/phase0_1/specs/lmnas_studio_product_recovery_spec_v_1.md`
- `docs/phase0_1/tasks/IMPLEMENTATION-ORCHESTRATION-007-product-recovery.md`
- `TEST-004` / `TV-E2E-07`

Developer tasks:

- [ ] Execute import-to-publish workflow through Studio UI only.
- [ ] Import source.
- [ ] Review proposed structure.
- [ ] Refine blocks.
- [ ] Assemble page.
- [ ] Edit content in-page.
- [ ] Bind widget/action.
- [ ] Apply shell/theme.
- [ ] Preview draft.
- [ ] Publish.
- [ ] Reopen and modify after publish.

Required evidence directory:

- `docs/phase0_1/proof/evidence/h007/`

Exit evidence:

- [ ] Screenshots for each major operator step.
- [ ] API logs for entity updates.
- [ ] JSON evidence for changed entities.
- [ ] JSON evidence for entities confirmed unchanged.
- [ ] Slug suppression proof.
- [ ] Publish safeguard proof.
- [ ] Widget safety proof.

### M12 - Final Validation And Closure

Requirement source:

- `docs/phase0_1/tests/TEST_OWNERSHIP_AND_VALIDATION_ADDENDUM.md`

Developer tasks:

- [ ] Run full local implementation-side verification.
- [ ] Update all relevant `PROOF` documents.
- [ ] Update `docs/phase0_1/WORKSTREAM.md`.
- [ ] Prepare structured handoff to Gemini.
- [ ] Remediate Gemini gap reports only through explicit issue IDs.
- [ ] Preserve final branch and commit hash.

Required developer return format:

```markdown
### IMPLEMENTATION RETURN [Handoff ID: H-007]
- **Branch Name**: <exact branch>
- **Commit Hash**: <full git SHA>
- **Requirement IDs Completed**: <REQ IDs>
- **Files Changed**: <repo-relative files>
- **Test IDs Executed Locally**: <TV-E2E / TV-MTR IDs>
- **Test Results**: <PASS/FAIL summary>
- **Evidence Summary**: <paths to screenshots, logs, JSON>
- **Strapi Persistence Evidence**: <paths or summary>
- **Settings Used**: <env flags and studio settings>
- **Known Limitations**: <none or explicit list>
- **Ready for Gemini Validation**: YES / NO
```

Exit evidence:

- [ ] Gemini returns `Ready` or `Ready with Exceptions`.
- [ ] Arun functional/UX review is complete.
- [ ] No open critical or high validation gaps remain.
- [ ] Final proof documents contain exact commands and exact results.

## Suggested Contracting Model

Use milestone acceptance, not time-only acceptance.

Recommended payment gates:

1. M0-M1: environment and RR lock.
2. M2-M3: close current open gates.
3. M4-M7: unified Studio, import, block normalization, page composer.
4. M8-M10: widgets/actions, shell/theme, publish center.
5. M11-M12: full `TV-E2E-07`, independent validation, final closure.

Do not accept a milestone without executable evidence and updated proof.
