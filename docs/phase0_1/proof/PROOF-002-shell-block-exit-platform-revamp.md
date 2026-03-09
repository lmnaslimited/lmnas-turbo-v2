# PROOF-002 - shell block exit platform revamp

## Linked Spec: SPEC-002

## Summary of changes

- Rebuilt onboarding as a visual six-step wizard in `apps/site`.
- Added first-class widget and action modeling in contracts, detectors, mappers, and Strapi sync payloads.
- Added visual detection cards with import/skip controls and mapping overrides.
- Reframed dry run as operator-facing **Preview What Will Be Created** summary.
- Added Strapi schema scaffolding for widget/action components and page references.
- Updated platform docs, README, and AGENTS to enforce UI-first operator flow and shell/block/widget/action/exit separation.

## Evidence

- Key implementation files:
  - `apps/site/app/platform/onboarding/OnboardingConsole.client.tsx`
  - `packages/contracts/src/platform.contracts.ts`
  - `packages/integrations/src/onboarding/onboarding-ui/index.ts`
  - `packages/integrations/src/onboarding/widget-detector/index.ts`
  - `packages/integrations/src/onboarding/action-detector/index.ts`
  - `packages/integrations/src/onboarding/strapi-sync/index.ts`
  - `services/strapi/src/components/widgets/widget-definition.json`
  - `services/strapi/src/components/actions/action-binding.json`

- Validation commands:
  - `pnpm lint` -> PASS
  - `pnpm typecheck` -> PASS
  - `pnpm test` -> PASS
  - `pnpm test:e2e` -> PASS
  - `pnpm test:e2e:real` -> PASS
  - `pnpm phase0:guard -- --id 002` -> PASS

- Visual evidence artifacts:
  - `apps/site/e2e/onboarding.visual.spec.ts-snapshots/source-preview-pane-darwin.png`
  - `apps/site/e2e/onboarding.visual.spec.ts-snapshots/detection-review-pane-darwin.png`
  - `apps/site/e2e/onboarding.visual.spec.ts-snapshots/final-assembly-preview-darwin.png`
  - `playwright-report/index.html`

## Acceptance Criteria verification

| AC item | Status (✅/❌) | Notes |
| --- | --- | --- |
| AC-1 | ✅ | Six-step visual wizard implemented in onboarding UI. |
| AC-2 | ✅ | Detection review uses visual cards with confidence, fields, CTA summaries, import/skip. |
| AC-3 | ✅ | Pipeline includes shell/block/widget/action/field/exit detectors and mappers. |
| AC-4 | ✅ | Contracts now include shell/block/widget/action/exit/onboarding schemas. |
| AC-5 | ✅ | Page assembly and Strapi payload include shell + block + widget + action + exit references. |
| AC-6 | ✅ | Exit runtime skeleton remains contract-driven and state-aware. |
| AC-7 | ✅ | Strapi component scaffolding expanded for shell/widget/action/exit. |
| AC-8 | ✅ | Docs, README, and AGENTS updated to operator-first visual workflow. |

## Deviations / follow-ups

- Detection heuristics remain deterministic and should be improved with richer source parsers over time.
- Apply mode still depends on configured Strapi credentials and currently emits fallback warning when unavailable.

## Release notes snippet (1-3 bullets)

- Added visual onboarding wizard with source preview, detection cards, and operator-first publish summary.
- Added governed widget/action model between CTA UI and exit contracts.
- Extended Strapi payload/schema scaffolding for widgets and actions without changing core block runtime behavior.
