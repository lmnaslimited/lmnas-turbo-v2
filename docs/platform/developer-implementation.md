# Developer Implementation Notes

## Architecture Guardrails

- Constitution v2.1 is authoritative.
- LMOP v1.2 (Product Architecture) is baseline.
- Schema-first contracts remain mandatory.
- Blocks/shells/widgets stay UI-only; CTA execution routes through action/exit adapters.

## Studio Surface

UI routes:

- `/platform/onboarding` (workflow dashboard)
- `/platform/onboarding/theme`
- `/platform/onboarding/blocks`
- `/platform/onboarding/shells`
- `/platform/onboarding/pages`

## Integration APIs

Analyze/publish:

- `POST /api/platform/onboarding/analyze`
- `POST /api/platform/studio/blocks/publish`

Theme:

- `GET/POST /api/platform/studio/themes`
- `POST /api/platform/studio/themes/activate`

Shell:

- `GET/POST /api/platform/studio/shells`
- `POST /api/platform/studio/shells/activate`

Blocks library:

- `GET/POST /api/platform/studio/blocks`

Pages:

- `GET/POST /api/platform/studio/pages`

Utility:

- `POST /api/platform/studio/reset` (deterministic e2e setup)

## Strapi Wiring

Studio routes attempt Strapi first, then fallback store:

- theme variants -> `theme-variants`
- shell variants -> `shell-variants`
- block templates -> `block-templates`
- page apply -> `content-importer` plan/apply pipeline

Fallback mode keeps workflows usable when Strapi is unavailable and returns operator-facing warnings.

## Async State Safety

Client helper:

- `apps/site/app/platform/onboarding/_lib/client-request.ts`
- abort-based timeout handling and normalized operator errors

Used in theme/blocks/shells/pages workflow pages to prevent dead UI states.

Source ingestion timeout:

- `packages/integrations/src/onboarding/source-ingestion/index.ts`
- URL fetch timeout to prevent hanging analyze requests on remote dependency stalls.

## Regression Test Coverage

E2E:

- `apps/site/e2e/studio-workflows.spec.ts`
  - theme load/browse/activate
  - block analyze/map/publish
  - analyze timeout/hang path
  - shell browse/edit/activate
  - page assemble/edit/override/save/publish
  - local `/en/<slug>` route verification after publish

Visual:

- `apps/site/e2e/onboarding.visual.spec.ts`
  - reference preview
  - detection review + Block Explorer
  - publish preview state

Unit/integration:

- `packages/integrations/src/onboarding.test.ts`
- `packages/integrations/src/onboarding/strapi-sync.test.ts`
- `apps/site/app/api/platform/studio/themes/activate/route.test.ts`
- onboarding analyze/publish API tests under `apps/site/app/api/platform/onboarding/*.test.ts`
