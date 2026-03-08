# Developer Implementation

## Technical Architecture

Primary orchestration entrypoints:
- `analyzeOnboardingSource`
- `publishOnboardingDraft`

Implemented module namespaces in `packages/integrations/src/onboarding`:
- `source-ingestion`
- `shell-detector`
- `block-detector`
- `field-detector`
- `exit-detector`
- `shell-schema-mapper`
- `block-schema-mapper`
- `exit-contract-registry`
- `strapi-sync`
- `page-assembler`
- `renderer`
- `theme-engine`
- `exit-adapter-runtime`
- `fidelity-reporter`
- `onboarding-ui`

## Strapi Integration

Current implementation generates governed Strapi sync payloads.
`apply` mode is scaffolded and gated by Strapi env presence.

## Frontend Integration

- Operator UI: `apps/site/app/platform/onboarding`
- API routes:
  - `api/platform/onboarding/analyze`
  - `api/platform/onboarding/publish`
  - `api/platform/exits/execute`

## Adapter Strategy

Exit runtime uses typed adapter maps:
- frontend adapter map
- backend adapter map

Adapters are replaceable without block-level changes.

## Exit Contract Handling

- Exit proposals become `ExitDefinition + ExitBinding` structures.
- Registry supports `register`, `resolve`, `setState`, `list`.
- Runtime executes only active exits.

## Shell-Aware Rendering

- Layouts now render through shell frame with nav/footer/utility slots.
- Page routes fetch shell render model separately from block rendering.

## Contract First

`@lmnas/contracts` now defines:
- shell contracts
- exit contracts
- onboarding analysis/publish contracts
- page extensions for shell assignment + exit bindings
