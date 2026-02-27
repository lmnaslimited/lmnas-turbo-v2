# LMNAs — Codex Operating Instructions

## Read-first (in this order)
1) ARCHITECTURE.md
2) docs/architecture/LMNAs_Platform_Operating_Constitution_v2_1.md
3) docs/operating/strategy/2026-02-17-LMNAS_OPERATING_BRIEF.md
4) docs/operating/strategy/2026-02-17-LMNAS_AI_Website_MVP_Operating_Brief.md
5) docs/operating/strategy/LMNAs_Master_Operating_Prompt_v1.2_Product_Architecture.md
6) docs/operating/strategy/LMNAs_Master_Operating_Prompt_v1.1_GTM.md
7) docs/operating/strategy/LMNAs_Master_Operating_Prompt_v1.0.md (fallback reference)

## Non-negotiables
- Schema-first: every Block must have a Zod schema and exported TS type.
- Blocks are pure UI: no hardcoded copy inside components.
- Every Block ships with: fixture JSON + tests (schema parse + render + snapshot/DOM).
- Conversion blocks MUST include: productMapping, conversionConfig, primaryCta.
  If missing → fail fast (throw) and do not render.

## Commands
- Install: npm install
- Test: npm test
- Lint: npm run lint
- Build: npm run build

## Block conventions
- Schema: lib/blocks/schemas/<block>.ts
- Component: components/blocks/<Block>.tsx
- Fixture: __fixtures__/blocks/<block>.json
- Tests: __tests__/blocks/<block>.test.tsx
- Registry: lib/blocks/registry.ts