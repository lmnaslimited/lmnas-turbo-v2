# Developer Implementation

## Architectural Baseline

- Constitution v2.1 is the governing guardrail
- LMOP v1.2 is the product architecture baseline
- Schema-first contracts are mandatory

## Core Modules

- `source-ingestion`: normalize URL/HTML/Figma/Stitch input
- `preview-renderer`: build styled source preview, thumbnail previews, and assembled preview HTML
- `shell-detector`: detect navbar/footer/utility/announcement
- `block-detector`: segment sections and classify block family
- `widget-detector`: detect reusable interactive surfaces
- `action-detector`: classify CTA click behavior
- `field-detector`: infer editable fields
- `exit-detector`: infer governed exit contracts
- `shell-schema-mapper`: map shell candidates to canonical shell schemas
- `block-schema-mapper`: apply block family/field overrides
- `widget-schema-mapper`: map widget candidates to definition/variant contracts
- `action-schema-mapper`: map CTA behavior to action bindings
- `exit-contract-registry`: register/resolve/toggle exit contracts
- `strapi-sync`: build and publish payloads
- `page-assembler`: compose shell + blocks + widgets + actions
- `renderer`: compare source structure and mapped structure
- `theme-engine`: token-first Tailwind analysis
- `fidelity-reporter`: plain-language warnings
- `env/bootstrap`: project-root env loading + required key validation

## Contracts

Primary schemas live in `packages/contracts/src/platform.contracts.ts`.

Key objects:

- shell models (`ShellVariant`, `NavbarVariant`, `FooterVariant`, `ShellAssignment`)
- block proposals
- widget definitions/variants
- action bindings
- exit definitions/bindings
- onboarding analysis/request/result

## Frontend Integration

- Onboarding UI route: `apps/site/app/platform/onboarding`
- Analyze API: `POST /api/platform/onboarding/analyze`
- Publish API: `POST /api/platform/onboarding/publish`
- Exit execution API: `POST /api/platform/exits/execute`
- Playwright visual/e2e: `apps/site/e2e/onboarding.visual.spec.ts`

## Strapi Integration

`StrapiSyncPayload` now includes:

- shell variants + menus
- block instances
- widget definitions + variants
- action bindings
- exit definitions + bindings
- page assembly

## Adapter Strategy

- Frontend adapters resolve UX behaviors (redirect/modal/form/chat)
- Backend adapters resolve workflow/system integration (`n8n_webhook`, `api`)
- New exits should be added by contract registration and adapter mapping

## Env Loading Strategy

- `apps/site/app/lib/env.ts` loads `.env`, `.env.local`, and env-specific files from project root.
- API routes call env bootstrap before publish/analyze logic.
- Integrations/content-importer runtimes use env bootstrap in-code (no manual shell export required for normal local flow).
- Publish apply validates `STRAPI_URL` and `STRAPI_API_TOKEN` and returns operator-safe readiness messaging.

## Testing Coverage

- Unit/integration:
  - detector + mapper + publish flow tests
  - missing env / invalid token / unreachable Strapi failure paths
  - low-confidence + fidelity warning paths
  - widget/exit mapping gap warnings
- E2E + visual:
  - styled source preview
  - detection card review and action traceability
  - assembled visual preview before publish
  - apply-mode `@real` path

## Contract-First Extensibility

For new workflow-heavy actions:

1. Add/extend exit contract
2. Register adapter mapping
3. Bind action to exit in config
4. Keep shell/block/widget code unchanged
