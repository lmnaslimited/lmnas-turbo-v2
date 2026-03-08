# LMNAs — Codex Operating Instructions

## Read-first (in this order)
1) ARCHITECTURE.md
2) docs/architecture/LMNAs_Platform_Operating_Constitution_v2_1.md
3) docs/operating/strategy/2026-02-17-LMNAS_OPERATING_BRIEF.md
4) docs/operating/strategy/2026-02-17-LMNAS_AI_Website_MVP_Operating_Brief.md
5) docs/operating/strategy/LMNAs_Master_Operating_Prompt_v1.2_Product_Architecture.md
6) docs/operating/strategy/LMNAs_Master_Operating_Prompt_v1.1_GTM.md
7) docs/operating/strategy/LMNAs_Master_Operating_Prompt_v1.0.md (fallback reference)
8) docs/blocks/contracts-sync.md
9) docs/blocks/strapi-model.md
10) docs/blocks/catalog.md
11) docs/codex/SCaffold_Spec_v1.1.md
12) docs/codex/Scaffold_Prompt_v1.1.md
13) docs/codex/README.md
14) docs/platform/vision.md
15) docs/platform/onboarding-workflow.md
16) docs/platform/exit-architecture.md

## Phase 0.1 Architect Governance

For all Phase 0.1 features:

GPT MUST read:
`docs/phase0_1/PHASE0_1_MASTER_PROMPT.md`

RR-flow artifacts (Intake, Spec, Tasks, Proof, ADR) MUST be generated using this master prompt.

Codex MUST NOT implement Phase 0.1 features unless:
- Intake exists
- Spec exists
- Tasks doc exists
- Guard validation passes

## Non-negotiables

- Schema-first: every Block must have a Zod schema and exported TS type.
- Blocks are pure UI: no hardcoded copy inside components.
- Every Block ships with: fixture JSON + tests (schema parse + render + snapshot/DOM).
- Conversion blocks MUST include: `productMapping`, `conversionConfig`, `primaryCta`.
  If missing -> fail fast (throw) and do not render.
- Policy A (allowlist): a block type is renderable only if it exists in BOTH
  - `packages/block-registry/src/generated/blocks.manifest.ts`
  - `packages/block-registry/src/index.ts`
- Unknown block types must fail fast.

## Canonical Platform Direction (Mandatory)

- Do NOT drift into WordPress-like page-builder architecture.
- Do NOT use raw HTML blob rendering as the default platform mode.
- Default onboarding path MUST be UI-first (`apps/site` onboarding console), not CLI-first.
- CLI importer remains for CI/debug/batch only.

Platform must preserve separation:
- Shell Layer: navbar/footer/submenus/variants/assignments
- Block Layer: canonical reusable block families
- Page Assembly Layer: shell + ordered blocks + footer composition
- Exit Layer: governed `exitId` contract bindings
- Execution Layer: adapter runtime + n8n workflows + Rudder events

Theme rule:
- Tailwind/theme belongs to platform/page scope.
- No block-owned theme engines.

Integration rule:
- Integrations must be specified and implemented through adapters.
- No business logic in blocks, navbar, or footer components.

## Commands

- Install: `npm install`
- Test: `npm test`
- Lint: `npm run lint`
- Build: `npm run build`

## Block conventions

- Schema: `packages/blocks/<Block>/schema.ts`
- Component: `packages/blocks/<Block>/Component.tsx`
- Fixture: `packages/blocks/<Block>/mock.ts` and `packages/blocks/<Block>/defaults.json`
- Tests: `packages/blocks/<Block>/Component.test.tsx`
- Registry: `packages/block-registry/src/index.ts`

## Website Onboarding conventions

- Operator-facing flow: `apps/site/app/platform/onboarding`
- Analysis API: `apps/site/app/api/platform/onboarding/analyze/route.ts`
- Publish API: `apps/site/app/api/platform/onboarding/publish/route.ts`
- Exit execution API: `apps/site/app/api/platform/exits/execute/route.ts`
- Onboarding modules: `packages/integrations/src/onboarding/*`
