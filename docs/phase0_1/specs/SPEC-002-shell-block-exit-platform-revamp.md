# SPEC-002 - shell block exit platform revamp

## Linked Intake: INT-002

## Scope

- Add governed shell/block/exit/onboarding contracts in `@lmnas/contracts`.
- Add a modular onboarding analysis pipeline in `@lmnas/integrations` with required module namespaces.
- Add UI-first onboarding workflow in `apps/site` (intake -> analysis -> confirmation -> publish payload).
- Add exit adapter runtime skeleton (frontend/backend adapter resolution by governed exit definitions).
- Add shell-aware page assembly scaffolding and Strapi schema scaffolding for shell/exit models.
- Add platform documentation package (`docs/platform/*`) and update root operator/developer guidance docs.

## Non-goals

- Build a visual drag-and-drop page builder.
- Implement Router/Identity/Personalization feature layers.
- Replace n8n or Rudder with alternate systems.
- Fully automate Strapi schema mutation at runtime.

## UX Flow (happy path, edge cases)

Happy path:
1. Operator opens onboarding console.
2. Operator submits source (URL/HTML/Figma/Stitch reference).
3. System analyzes source and proposes shell, block families, fields, exits, and fidelity notes.
4. Operator confirms/adjusts mappings.
5. System generates Strapi sync payload and page assembly payload.
6. Operator publishes (dry-run by default, governed apply when configured).

Edge cases:
- Source unreachable or malformed -> analysis error + guidance.
- Low-confidence block classification -> flag with override controls.
- Missing shell candidates -> fallback shell assignment and warning.
- Exit detection with no known adapter -> register as inactive pending adapter.

## Data Flow (inputs -> transforms -> outputs)

Inputs:
- Source intake payload (`kind`, `payload`, metadata)

Transforms:
- `source-ingestion` normalizes source
- detectors infer shell/block/field/exit proposals
- mappers convert detection output to canonical shell/block/exit structures
- `theme-engine` and `fidelity-reporter` emit debt/warning signals
- `strapi-sync` builds publish payload

Outputs:
- Onboarding analysis model
- Page assembly model
- Strapi sync payload (shell variants, block instances, exit definitions/bindings)
- Publish result with warnings and follow-up actions

## Interfaces / Contracts impacted

- `Page` contract: shell assignment + exit bindings + theme scope metadata
- Hero conversion block contract: governed CTA fields (`primaryCta`, `productMapping`, `conversionConfig`)
- New shell contracts:
  - `ShellVariant`, `NavbarVariant`, `FooterVariant`, `NavigationMenu`, `NavigationItem`, `NavigationGroup`, `FooterColumn`, `FooterLegalStrip`, `ShellAssignment`
- New exit contracts:
  - `ExitDefinition`, `ExitBinding`, `ExitState`, `ExitPolicy`, `ExitExecutionTarget`, `ExitPayloadSchema`, `ExitAuditLog`
- New onboarding contracts:
  - intake, analysis, mapping override, publish request/result

## Files to Create/Modify

| Path | Change Type | Reason |
| --- | --- | --- |
| `packages/contracts/src/index.ts` | modify | Export shell/block/exit/onboarding contracts |
| `packages/contracts/src/platform.contracts.ts` | create | Canonical schemas/types for shell+exit+onboarding |
| `packages/contracts/src/contracts.test.ts` | modify | Validate new contracts and conversion fields |
| `packages/blocks/Hero/*` | modify | Enforce governed conversion fields and exit-aware CTA binding |
| `packages/integrations/src/onboarding/**` | create | Implement required onboarding modules and orchestration |
| `packages/integrations/src/index.ts` | modify | Export onboarding + exit runtime APIs |
| `packages/integrations/src/strapiClient.ts` | modify | Read/write page shell/exit scaffolding fields |
| `packages/integrations/src/strapiClient.test.ts` | modify | Validate shell/exit mapping behavior |
| `packages/layouts/src/index.ts` | modify | Add shell frame primitives and variant-aware rendering |
| `packages/layouts/src/layouts.test.ts` | modify | Validate layout + shell rendering contract |
| `packages/renderer/src/index.tsx` | modify | Enforce conversion-block governance checks with fail-fast behavior |
| `packages/renderer/src/renderer.test.tsx` | modify | Validate fail-fast and preview diagnostics |
| `apps/site/app/platform/onboarding/*` | create | UI-first onboarding console |
| `apps/site/app/api/platform/onboarding/*` | create | Analyze/publish API endpoints for onboarding UI |
| `apps/site/app/layout.tsx` | modify | Align app shell wrapper with platform shell-first direction |
| `services/strapi/src/components/shell/*.json` | create | Shell component model scaffolding |
| `services/strapi/src/components/exits/*.json` | create | Exit component model scaffolding |
| `services/strapi/src/api/page/content-types/page/schema.json` | modify | Add shell + exit component references |
| `docs/platform/*.md` | create | Required platform/operator/developer docs set |
| `README.md` | modify | UI-first operator path and new platform model |
| `AGENTS.md` | modify | Enforce shell/block/exit governance and anti-drift rules |

## Test Plan (unit/integration/e2e)

- Unit:
  - Contracts parse for shell/exit/onboarding models
  - Detector modules classify shell/blocks/exits from HTML fixtures
  - Exit registry/runtime activation + execution path
- Integration:
  - Onboarding orchestration end-to-end from intake -> publish payload
  - `strapiClient` maps optional shell/exit fields
- UI route/API:
  - Analyze and publish API route behavior
  - Console renders analysis and publish result states
- Baseline validation:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

## Rollout / Risk notes

- Backward compatibility risk for existing hero data shape; mitigate with normalization fallbacks where possible.
- Strapi content model expansion is scaffold-level; runtime migration scripts remain follow-up.
- UI onboarding is governed MVP scaffold; advanced Figma/Stitch adapters stay extensible via adapter registry.

## Links (Tasks/Proof placeholders)

- Tasks: TASK-002
- Proof: PROOF-002
