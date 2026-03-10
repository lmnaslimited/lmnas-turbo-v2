# LMNAs — Codex Operating Instructions

## Read-first (in this order)
1) ARCHITECTURE.md
2) docs/architecture/LMNAs_Platform_Operating_Constitution_v2_2.md
3) docs/phase0_1/tests/TEST_OWNERSHIP_AND_VALIDATION_ADDENDUM.md
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

## Phase 0.1 Test Ownership & Validator Constraints
- **Claude / Codex (Implementers)**: Own local implementation, Unit tests, and local workflow E2E.
- **Gemini (Validator)**: Tests exclusively against `SPEC` requirements producing Gap reports. Gemini NEVER writes code or auto-fixes implementations.
- Implementers never independent-validate their own work.

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

Do not drift into WordPress-like or CLI-heavy onboarding.

Default onboarding path MUST be UI-first visual wizard in `apps/site/app/platform/onboarding`.

Platform objects are first-class and separate:
- Shells: navbar/footer/utility/announcement
- Blocks: reusable content sections
- Widgets: reusable interactive surfaces
- Actions: CTA behavior bindings
- Exits: backend/business integration contracts

Hard rules:
- Blocks/shells/widgets do not own business logic.
- CTA behavior must route through `ActionBinding`.
- Workflow/integration behavior must route through `ExitDefinition` + adapters.
- Do not expose raw JSON payloads as the primary operator UX.
- Technical IDs should remain advanced details, not first-step operator burden.

Theme/integration rules:
- Tailwind/theme belongs to platform/page scope; no block-owned theme engines.
- Integrations must be specified and implemented through adapters.
- n8n remains orchestration center.
- Rudder remains unified event stream.

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

- Operator flow: `apps/site/app/platform/onboarding`
- Analyze API: `apps/site/app/api/platform/onboarding/analyze/route.ts`
- Block Publish API: `apps/site/app/api/platform/studio/blocks/publish/route.ts`
- Exit execution API: `apps/site/app/api/platform/exits/execute/route.ts`
- Onboarding modules: `packages/integrations/src/onboarding/*`
