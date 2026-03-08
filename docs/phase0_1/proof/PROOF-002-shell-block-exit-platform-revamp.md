# PROOF-002 - shell block exit platform revamp

## Linked Spec: SPEC-002

## Summary of changes

- Added governed shell/block/exit/onboarding contracts in `@lmnas/contracts`.
- Added required onboarding module stack in `@lmnas/integrations/src/onboarding/*`.
- Implemented UI-first onboarding console and API endpoints in `apps/site`.
- Added shell-aware layout rendering and exit runtime bridge scaffolding.
- Added Strapi shell/exit component schemas and page schema references.
- Added full platform documentation set under `docs/platform/*`.
- Updated root `README.md` and `AGENTS.md` to enforce UI-first governed direction.

## Evidence

- UI screenshots (if applicable):
  - N/A in this proof (code + tests only).
- Test output summary:
  - `pnpm typecheck` -> PASS
  - `pnpm lint` -> PASS
  - `pnpm test` -> PASS
- Links to key files:
  - `packages/contracts/src/platform.contracts.ts`
  - `packages/integrations/src/onboarding/onboarding-ui/index.ts`
  - `apps/site/app/platform/onboarding/OnboardingConsole.client.tsx`
  - `apps/site/app/api/platform/onboarding/analyze/route.ts`
  - `apps/site/app/api/platform/onboarding/publish/route.ts`
  - `packages/layouts/src/index.tsx`
  - `docs/platform/vision.md`

## Acceptance Criteria verification

| AC item | Status (✅/❌) | Notes |
| --- | --- | --- |
| AC-1 | ✅ | UI-first onboarding console and analyze/publish flow implemented in `apps/site`. |
| AC-2 | ✅ | All required onboarding module namespaces implemented under `packages/integrations/src/onboarding`. |
| AC-3 | ✅ | Shell/exit/onboarding contracts implemented and exported from `@lmnas/contracts`. |
| AC-4 | ✅ | Page contract extended with shell assignment + exit bindings; shell-aware rendering wired in routes/layouts. |
| AC-5 | ✅ | Exit contract registry and adapter runtime skeleton implemented; execution route added. |
| AC-6 | ✅ | Strapi shell/exit schema scaffolding added; page schema references added. |
| AC-7 | ✅ | `docs/platform/*` created; `README.md` and `AGENTS.md` updated to new direction. |

## Deviations / follow-ups

- `apply` mode currently returns governed payload and only applies when Strapi env is configured; full write migration remains a follow-up.
- Detector heuristics are intentionally deterministic/basic in this iteration and should be expanded with richer parsing for production-scale imports.

## Release notes snippet (1-3 bullets)

- Added UI-first shell/block/exit onboarding console and API workflow.
- Added governed shell and exit contract/runtime scaffolding across contracts, integrations, layouts, and Strapi schemas.
- Added canonical platform documentation set for operators and developers.
