# TASK-002 - shell block exit platform revamp

## Linked Spec: SPEC-002

## Preconditions checklist (spec exists, contracts ready)

- [x] Spec exists and is approved.
- [x] Required contracts/schemas are ready.
- [x] Dependencies and environment constraints are clear.

## Step-by-step tasks

| Step | File paths | Definition of done |
| --- | --- | --- |
| 1 | `docs/phase0_1/intake/INT-002*`, `docs/phase0_1/specs/SPEC-002*`, `docs/phase0_1/tasks/TASK-002*`, `docs/phase0_1/proof/PROOF-002*`, `docs/phase0_1/adr/ADR-002*` | RR-flow docs are complete, linked, and guard-passing |
| 2 | `packages/contracts/src/platform.contracts.ts`, `packages/contracts/src/index.ts`, `packages/contracts/src/contracts.test.ts` | Shell/block/widget/action/exit/onboarding schemas are implemented and exported; tests cover parse behavior |
| 3 | `packages/blocks/Hero/*`, `packages/renderer/src/*`, `packages/block-registry/src/*` | Conversion block governance is enforced (`productMapping`, `primaryCta`, `conversionConfig`) with fail-fast behavior |
| 4 | `packages/integrations/src/onboarding/**`, `packages/integrations/src/index.ts`, `packages/integrations/src/strapiClient.ts`, `packages/integrations/src/strapiClient.test.ts` | Required module scaffolds are implemented and orchestrated through public integration APIs, including widget/action detection/mapping |
| 5 | `apps/site/app/platform/onboarding/*`, `apps/site/app/api/platform/onboarding/*`, `apps/site/app/layout.tsx` | Visual onboarding wizard and API flow are functional |
| 6 | `packages/layouts/src/*`, `packages/testkit/src/*` | Shell-aware assembly primitives and fixtures align with new model |
| 7 | `services/strapi/src/components/shell/*.json`, `services/strapi/src/components/exits/*.json`, `services/strapi/src/components/widgets/*.json`, `services/strapi/src/components/actions/*.json`, `services/strapi/src/api/page/content-types/page/schema.json` | Strapi shell/widget/action/exit scaffolding is present and page schema references are added |
| 8 | `docs/platform/*.md`, `README.md`, `AGENTS.md` | Platform docs and governance docs match the new operating direction |
| 9 | repo-wide validation commands | Lint, typecheck, and tests are run; results captured in proof |

## Commands to run (pnpm lint/typecheck/test or repo-equivalents)

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Completion Checklist mapping to Acceptance Criteria

- [x] AC-1 mapped and verified.
- [x] AC-2 mapped and verified.
- [x] AC-3 mapped and verified.
- [x] AC-4 mapped and verified.
- [x] AC-5 mapped and verified.
- [x] AC-6 mapped and verified.
- [x] AC-7 mapped and verified.
- [x] AC-8 mapped and verified.
