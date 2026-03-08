# Developer Implementation

## Architectural Baseline

- Constitution v2.1 is the governing guardrail
- LMOP v1.2 is the product architecture baseline
- Schema-first contracts are mandatory

## Core Modules

- `source-ingestion`: normalize URL/HTML/Figma/Stitch input
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

## Contract-First Extensibility

For new workflow-heavy actions:

1. Add/extend exit contract
2. Register adapter mapping
3. Bind action to exit in config
4. Keep shell/block/widget code unchanged
