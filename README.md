# LMNAs Turbo v2

Local-first monorepo platform scaffold for `lmnas.com` with block-based rendering, Strapi CMS, n8n, and deterministic mocks.

## Quick Start

1. `pnpm install`
2. `cp .env.example .env`
3. `docker compose up -d`
4. `pnpm dev`

Expected local services:
- Site: `http://localhost:3000`
- Strapi: `http://localhost:1337`
- n8n: `http://localhost:5678`
- Lens mock: `http://localhost:4010/appointments`
- Rudder mock: `http://localhost:4011/track`

## Repository Layout

- `apps/site`: Next.js App Router site for `lmnas.com`.
- `apps/docs`: placeholder Next.js app for `docs.lmnas.com`.
- `apps/blogs`: placeholder Next.js app for `blogs.lmnas.com`.
- `apps/gateway`: optional gateway placeholder and rewrite guidance.
- `packages/blocks`: pure block components (`Hero`, `FAQ`) + schemas/defaults/mocks.
- `packages/block-registry`: maps block type -> component + zod schema.
- `packages/renderer`: validates and renders blocks safely.
- `packages/seo-engine`: meta and JSON-LD generation.
- `packages/contracts`: zod contracts for page/block/Strapi payloads.
- `packages/integrations`: transport adapters (`strapiClient`, `lens`, `analytics`).
- `packages/testkit`: fixtures and test utilities.
- `packages/eslint-config`: boundary guardrail rules.
- `services/strapi`: Strapi v4 CMS project with seeded `home` page.
- `services/n8n`: versioned workflow folder.
- `services/mocks`: local express mocks (`lens-api`, `rudder`).
- `infra/docker-compose.yml`: local service stack.

## Guardrails

- No reusable components in apps: `apps/*/src/components/**` is forbidden.
- Apps must not use direct external API clients (`axios`, `fetch wrappers`, etc.) for platform integrations.
- Zod schemas live only in `packages/contracts` and `packages/blocks/*/schema.ts`.
- Blocks are pure and do not fetch data.
- Integrations only adapt transport + validate; no business logic.

## Gateway Rewrites (Placeholder)

`apps/gateway` is optional locally, but intended production host routing is:
- `lmnas.com` -> `apps/site`
- `docs.lmnas.com` -> `apps/docs`
- `blogs.lmnas.com` -> `apps/blogs`

## How Preview Works

- Preview route: `http://localhost:3000/preview?slug=home&token=local-preview-token`
- Token checking is local-friendly (optional if `STRAPI_PREVIEW_TOKEN` is unset).
- In preview mode invalid blocks render an explicit error card with the zod issue path.
- In production mode invalid blocks are skipped safely with placeholder UI.

## Blogs Canonical + Rudder

- `BLOG_CANONICAL_BASE` controls canonical URL generation for blog pages.
  - default: `https://lmnas.com/blogs`
  - canonicals should always resolve to the lmnas.com blogs base, including alias apps.
- Rudder tracking is centralized in `@lmnas/analytics`.
- Cross-app cookie strategy uses `RUDDER_COOKIE_DOMAIN=.lmnas.com` so attribution remains consistent across `apps/site`, `apps/docs`, and `apps/blogs`.

## Add a New Block (Manual)

1. Create `packages/blocks/<BlockName>/` with:
   - `Component.tsx`
   - `schema.ts`
   - `defaults.json`
   - `mock.ts`
   - `index.ts`
2. Export the block from `packages/blocks/index.ts`.
3. Register it in `packages/block-registry/src/index.ts`.
4. Extend unions/contracts in `packages/contracts/src/index.ts`.
5. Add tests in `packages/renderer` and (if needed) `packages/seo-engine`.

## Codex Block Generation Placeholder

Future generator contract (placeholder):
- Command: `pnpm generate:block <BlockName>`
- Expected output: creates block files + updates exports + registry wiring + contract union.

Generator is intentionally left as a placeholder in this scaffold; manual flow above is the source of truth.

## Strapi Notes

- Content type: `Page` with `slug`, dynamic zone `blocks` (`hero`, `faq`), component `seo`.
- Bootstrap seeds page `home` and attempts to enable public `find/findOne` permissions for page API.
- If Strapi is temporarily unavailable, `@lmnas/integrations` falls back to `@lmnas/testkit` fixture so the site still renders.

## Codex Scaffold Docs

- Scaffold spec and copy/paste prompt are versioned under `docs/codex/`.
- Start here: `docs/codex/README.md`.
