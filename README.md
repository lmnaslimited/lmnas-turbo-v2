# LMNAs Turbo v2

Local-first monorepo platform scaffold for `lmnas.com` with block-based rendering, Strapi v5 CMS, n8n, and local mocks.

## Architecture & Governance

The authoritative architecture document and architectural guardrail for this repository is `docs/architecture/LMNAs_Platform_Operating_Constitution_v2_1.md`.
All architectural decisions must align with this Constitution.
If there is a conflict between implementation and documentation, the Constitution prevails.
Codex prompts and scaffold specs must comply with this document.

### Architecture Hierarchy

1. Platform Operating Constitution (highest authority)
2. Platform Spec
3. Codex Scaffold Prompt
4. Implementation

### Phase 0 Baseline Status

The repository is currently aligned to Phase 0 baseline.
Router engine, Identity model, and Personalization are intentionally out of scope.
Any introduction of these requires explicit spec updates.

## Quick Start

1. `pnpm install`
2. `cp .env.example .env`
3. `docker compose up -d`
4. `pnpm dev`

## Content Importer Runtime

Required environment variables:
- `STRAPI_URL` (example: `http://localhost:1337`)
- `STRAPI_TOKEN` (Strapi API Token with write permissions)

Optional:
- `STRAPI_GRAPHQL_PATH` (default: `/graphql`)

Token check (GraphQL ping):
```bash
curl -X POST "${STRAPI_URL}/graphql" \\
  -H "Authorization: Bearer ${STRAPI_TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d '{ "query": "query Ping { __typename }" }'
```

Importer commands:
- `pnpm content:onboard --url https://lmnas.com/en --slug home --locale en` (one-command dry-run onboarding)
- `pnpm content:onboard --url https://lmnas.com/en --slug home --locale en --apply` (one-command apply)
- `pnpm content:schema`
- `pnpm content:schema:facts`
- `pnpm content:plan --url https://lmnas.com/en --slug home --locale en --out /tmp/plan.json`
- `pnpm content:validate-plan --plan /tmp/plan.json`
- `pnpm content:apply --plan /tmp/plan.json` (writes as draft by default)
- `pnpm content:apply --plan /tmp/plan.json --publish` (explicitly publish)
- `pnpm content:apply --plan /tmp/plan.json --force-create` (always create, auto-suffix slug if needed)
- `pnpm content:apply --plan /tmp/plan.json --force-update` (must exist)
- `pnpm content:apply --plan /tmp/plan.json --force-replace` (delete existing and recreate)

Notes:
- Importer is Strapi v5 GraphQL schema-driven (introspection-backed), not hardcoded to v4 query signatures.
- Introspection is written to `packages/content-importer/src/strapi/schema/introspection.json`.
- `content:apply` treats `plan.json` as desired state and can repair broken/partial CMS records using repair-safe reads.

## Runtime Requirements

This repository requires Node 22 LTS.

If using nvm:
`nvm install 22`
`nvm use 22`

If using Volta:
`volta install node@22`

Expected local services:
- Site: `http://localhost:3000`
- Strapi: `http://localhost:1337`
- n8n: `http://localhost:5678`
- Lens mock: `http://localhost:4010/appointments`
- Rudder mock: `http://localhost:4011/track`

## Repository Layout

- `apps/site`: Next.js App Router site for `lmnas.com`
- `apps/docs`: placeholder Next.js app for `docs.lmnas.com`
- `apps/blogs`: blog alias app for `blogs.lmnas.com`
- `packages/blocks`: pure block components (`Hero`, `FAQ`) + schemas/defaults/mocks
- `packages/block-registry`: maps block type -> component + zod schema
- `packages/layouts`: layout registry (`LayoutRegistry`)
- `packages/renderer`: validates and renders blocks safely
- `packages/seo-engine`: meta and JSON-LD generation, blog canonical support
- `packages/contracts`: zod contracts for page/navigation/blog payloads
- `packages/integrations`: typed GraphQL integrations for Strapi page/navigation/blog reads
- `packages/analytics`: shared Rudder wrapper used by site/blogs apps
- `packages/testkit`: fixtures and test utilities
- `packages/eslint-config`: boundary guardrail rules
- `services/strapi`: Strapi v5 CMS project
- `services/n8n`: workflow folder
- `services/mocks`: local express mocks (`lens-api`, `rudder`)
- `docker-compose.yml`: local service stack

## Phase 0 Rules

In scope:
- CMS-driven routes (`/`, `/[...slug]`, `/blogs`, `/blogs/[slug]`)
- `conversionConfig` enforcement
- CMS navigation (`main`, `footer`) rendering in site shell
- GraphQL reads for pages/navigation/blogs
- dual-access blog canonical behavior
- shared analytics module usage
- `/api/health`

Out of scope:
- Router engine
- Identity model
- Personalization

## Policy A (Block Allowlist)

- A block type is valid only when it exists in both:
  - `packages/block-registry/src/generated/blocks.manifest.ts`
  - `packages/block-registry/src/index.ts` (`blockRegistry`)
- Unknown block types fail fast before render.
- Contracts are the source of truth; run `pnpm contracts:gen` and `pnpm contracts:check` to keep manifest and registry aligned.

## Preview + Publication Behavior

### Environment
Set preview token in `.env`:
- `PREVIEW_SECRET=local-preview-token`
- `STRAPI_PREVIEW_TOKEN=local-preview-token` (fallback compatibility)

### Site preview URL
- `http://localhost:3000/preview?slug=home&token=local-preview-token`

### Admin preview flow
- Strapi admin preview uses `services/strapi/config/admin.js`
- Preview URL points to `http://localhost:3000/api/preview?...`
- `/api/preview` toggles Next draft mode based on `status` and redirects to real route

### Expected behavior
- Live routes (`/`, `/[...slug]`) show published snapshot only
- Preview session shows draft content
- Unpublished pages return 404 on live routes

## GraphQL Notes (Strapi v5)

- GraphQL plugin is enabled in `services/strapi/config/plugins.js`
- Endpoint: `http://localhost:1337/graphql`
- Integration layer uses Strapi v5 query shape (`status`, flat nodes, `documentId`) and keeps v4 compatibility fallback logic
- REST is not used for pages/navigation/blog reads

## Blogs Canonical + Rudder

- `BLOG_CANONICAL_BASE` controls canonical URL generation for blog pages
  - default: `https://lmnas.com/blogs`
- Canonicals resolve to lmnas.com blogs base, including alias app routes
- Rudder tracking is centralized in `@lmnas/analytics`
- Cross-app cookie strategy: `RUDDER_COOKIE_DOMAIN=.lmnas.com`

## Seeded CMS Content

Strapi bootstrap seeds:
- Pages: `home`, `products/cpq`, `solutions/tender-intelligence`, `about`
- Navigation: `main`, `footer`
- Blog post: `phase-0-baseline`

## Validation

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Codex Scaffold Docs

- `docs/codex/SCaffold_Spec_v1.1.md`
- `docs/codex/Scaffold_Prompt_v1.1.md`
- `docs/codex/README.md`
