# INT-002 - shell block exit platform revamp

## Problem / Job-to-be-done

Current onboarding is still too technical and console-like for non-technical operators. The platform must shift to a visual, governed, UI-first operating model that imports source designs/pages into reusable shells, canonical blocks, reusable widgets, explicit CTA actions, and configurable exits.

## User / ICP persona

- Website content operator (non-technical content manager)
- Marketing operations lead responsible for page updates and CTA operations
- Platform engineer responsible for contracts, adapters, and governance

## Trigger (where in site/product)

- Importing website sections/pages from Stitch/Figma/URL/HTML
- Assembling pages in CMS with reusable shell + block assets
- Updating business CTA behavior without touching block code

## Desired outcome

- Operator-first onboarding flow (UI-led, CLI secondary)
- Shell-aware page assembly (navbar/footer variants as first-class systems)
- Action + widget + exit governed behavior model (CTA -> action -> widget/exit)
- Schema-first contracts for shell/block/exit and onboarding artifacts
- Strapi model scaffolding and sync payload generation for shell/block/exit

## Non-goals

- Drag-anything-anywhere visual builder
- Router, identity, or personalization runtime implementation
- Workflow engine replacement for n8n
- Business logic embedded directly in blocks

## Constraints (Phase 0 rules, Policy A, Node 22, etc.)

- Constitution v2.1 remains governing architecture guardrail.
- Strapi remains source of truth for governed content.
- Blocks remain pure UI and schema-first.
- Policy A allowlist for renderable block types remains enforced.
- n8n remains orchestration layer; Rudder remains event stream layer.
- Tailwind/theme direction remains platform/page scoped; no block-owned theme engines.
- Node 22 + existing monorepo scripts/tests must stay operable.

## Acceptance Criteria (observable bullets)

- [ ] AC-1: A visual onboarding wizard exists in `apps/site` with six steps (intake, source preview, detection review, selection/mapping, action mapping, publish summary).
- [ ] AC-2: Detection output is shown as visual cards with import/skip controls, type badges, confidence, editable fields, and CTA/action summaries.
- [ ] AC-3: Required onboarding modules exist and are wired through a single orchestration path including `widget-detector` and `action-detector`.
- [ ] AC-4: Contracts/types for shell/block/widget/action/exit/onboarding artifacts are added in `@lmnas/contracts`.
- [ ] AC-5: Shell-aware page assembly model supports shell + blocks + widgets + action bindings.
- [ ] AC-6: Exit runtime skeleton supports registration + activation/deactivation + execution target mapping without block code changes.
- [ ] AC-7: Strapi schema scaffolding for shell/widget/action/exit structures is added.
- [ ] AC-8: Documentation set under `docs/platform/*` plus `README.md` + `AGENTS.md` reflects operator-first visual workflow and mental model.

## Telemetry / Analytics (what will be tracked; allow "TBD")

- `onboarding_source_submitted`
- `onboarding_analysis_completed`
- `onboarding_shell_confirmed`
- `onboarding_blocks_confirmed`
- `onboarding_exit_binding_confirmed`
- `onboarding_publish_requested`
- `exit_triggered`
- `exit_execution_result`

## Links (Spec/Tasks/Proof placeholders)

- Spec: SPEC-002
- Tasks: TASK-002
- Proof: PROOF-002
