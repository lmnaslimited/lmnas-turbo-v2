# INT-002 - shell block exit platform revamp

## Problem / Job-to-be-done

Current onboarding is CLI-heavy and page-centric, which increases operator friction and pushes non-technical users into developer workflows. The platform must shift to a governed, UI-first operating model that imports source designs/pages into reusable shell systems, canonical blocks, and configurable exits.

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
- Exit-governed behavior model (CTA binds to exit contracts)
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

- [ ] AC-1: A UI-first onboarding console exists in `apps/site` with source intake, analysis, confirmation, and publish steps.
- [ ] AC-2: Required onboarding module scaffolds exist and are wired through a single orchestration path (`source-ingestion`, `shell-detector`, `block-detector`, `field-detector`, `exit-detector`, `shell-schema-mapper`, `block-schema-mapper`, `exit-contract-registry`, `strapi-sync`, `page-assembler`, `renderer`, `theme-engine`, `exit-adapter-runtime`, `fidelity-reporter`).
- [ ] AC-3: Contracts/types for shell/block/exit/onboarding artifacts are added in `@lmnas/contracts`.
- [ ] AC-4: Shell-aware page assembly model is added to page contracts and consumed by rendering path.
- [ ] AC-5: Exit runtime skeleton supports registration + activation/deactivation + execution target mapping without block code changes.
- [ ] AC-6: Strapi schema scaffolding for shell and exit structures is added.
- [ ] AC-7: Documentation set under `docs/platform/*` is created and `README.md` + `AGENTS.md` are updated to enforce UI-first governed direction.

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
