# LMNAS Turbo v2 Platform

## Local boot
1. `pnpm preflight` (optional preflight check)
2. `pnpm install`
3. `cp .env.example .env`
4. `docker compose up -d`
5. `pnpm dev`

URLs:
- Site: http://localhost:3000
- Docs: http://localhost:3001
- Blogs: http://localhost:3002
- Strapi: http://localhost:1337
- n8n: http://localhost:5678
- Lens mock: http://localhost:4010/appointments
- Rudder mock: http://localhost:4011/track

## Folder purpose
- `apps/site`: primary web app with block renderer and preview route.
- `apps/docs`: docs shell app.
- `apps/blogs`: blogs shell app.
- `apps/gateway`: placeholder for future edge routing.
- `packages/blocks`: pure block components + schemas.
- `packages/block-registry`: maps block types to component/schema.
- `packages/renderer`: safe rendering with preview-time validation errors.
- `packages/seo-engine`: metadata + FAQ JSON-LD generation.
- `packages/contracts`: Zod contracts and Strapi response schemas.
- `packages/integrations`: transport adapters (Strapi/Lens/analytics).
- `packages/testkit`: fixtures and test helpers.
- `packages/eslint-config`: boundary and drift guardrails.
- `services/strapi`: Strapi v4 app with seeded `home` page.
- `services/mocks`: local express mocks.
- `services/n8n`: versioned workflows.
- `infra/docker-compose.yml`: local stack orchestration.

## Guardrails
- No reusable components in `apps/*/src/components/**`.
- Apps must not import raw service clients from service folders.
- Zod schemas only in `packages/contracts` and `packages/blocks/*/schema.ts`.
- Blocks are pure presentation and do not fetch.
- Integrations are transport adapters and must validate payloads.

## Add a new block (manual)
1. Create `packages/blocks/src/<Block>/` with `Component.tsx`, `schema.ts`, `defaults.json`, `mock.ts`, `index.ts`.
2. Export it from `packages/blocks/src/index.ts`.
3. Register in `packages/block-registry/src/index.ts`.
4. Update contracts union in `packages/contracts/src/index.ts`.
5. Add renderer/seo tests as needed.

## Codex block generator placeholder
Use a future generator command such as `pnpm gen:block <name>` (placeholder) to scaffold block files and registration edits.

## Preview flow
- Strapi Preview URL should point to `/preview?slug=<slug>&token=<optional>`.
- Route exists at `apps/site/app/preview/page.tsx` and renders preview validation errors inline.


## Troubleshooting
- If `pnpm install` returns `ERR_PNPM_FETCH_403`, your environment cannot access `registry.npmjs.org` (proxy/policy). Configure a permitted registry/proxy and rerun `pnpm preflight`.
- If `docker compose` is unavailable, install Docker CLI + Compose plugin before running stack commands.
