# Codex Scaffold Spec v1.1-final (Phase 0 Baseline Upgrade)

## Document Metadata
- Name: `Codex Scaffold Spec v1.1-final (Phase 0 Baseline Upgrade)`
- Platform baseline: `LMNAs Platform Operating Constitution v2.1`
- Scope: Turborepo local-first, CMS-driven web platform scaffold with explicit Phase 0 stabilization gate.

## Purpose
Defines full scaffold requirements for the current Phase 0 implementation in this repository.

## Phase 0 Stabilization Gate (Mandatory)
Phase 0 is a hard gate. All items in this spec MUST pass before any Phase 1+ work.

Explicitly out of scope for Phase 0:
- Router engine
- Identity model
- Personalization

## Non-negotiable Outcomes
After local boot:
- Next.js apps run
- Strapi v5 runs
- Strapi admin preview works
- `/api/health` works
- Page contracts are validated (including mandatory `conversionConfig`)
- pages/navigation/blog reads use GraphQL integrations (no REST reads for these domains)
- architectural guardrails remain enforced

## Architecture Overview
### Apps
- `apps/site`
- `apps/docs`
- `apps/blogs`

### Packages
- `packages/blocks`
- `packages/block-registry`
- `packages/layouts`
- `packages/renderer`
- `packages/seo-engine`
- `packages/contracts`
- `packages/integrations`
- `packages/analytics`
- `packages/testkit`
- `packages/eslint-config`

### Services
- `services/strapi`
- `services/n8n`
- `services/mocks`
- `docker-compose.yml`

## Routing Model (CMS-Driven)
- `apps/site/app/page.tsx` -> `/` -> CMS slug `home`
- `apps/site/app/[...slug]/page.tsx` -> joined slug (for example `products/cpq`)
- `apps/site/app/preview/page.tsx` -> `/preview?slug=...&token=...` token validation + redirect to preview session route
- `apps/site/app/api/preview/route.ts` -> enables/disables Next draft mode using `status` and redirects to target path
- `apps/site/app/blogs/page.tsx` -> `/blogs`
- `apps/site/app/blogs/[slug]/page.tsx` -> `/blogs/[slug]`
- `apps/site/app/api/health/route.ts` -> `/api/health`
- `apps/blogs/app/page.tsx` -> `/`
- `apps/blogs/app/[slug]/page.tsx` -> `/<slug>`

## Strapi v5 Content + Preview Model
### Version
- Strapi runtime is v5 (`@strapi/strapi@^5`, GraphQL plugin v5).

### Content types
- `services/strapi/src/api/page/content-types/page/schema.json`
- `services/strapi/src/api/navigation/content-types/navigation/schema.json`
- `services/strapi/src/api/blog-post/content-types/blog-post/schema.json`

All three use Draft & Publish.

### Page model requirements
- `slug` unique string
- `pageType` enum required: `home | product | solution | industry | simple`
- `layoutKey` enum required: `homeLayout | productLayout | solutionLayout | industryLayout | simpleLayout`
- `conversionConfig` required component:
  - `primary`: `book | benefit | download | subscribe`
  - `product`: non-empty string
  - `industry`: non-empty string
- `blocks` dynamic zone
- `seo` required component

### Preview behavior (must remain true)
- Live site routes (`/`, `/[...slug]`) fetch **published snapshot** only.
- Preview session uses Next draft mode and fetches **draft** state.
- Unpublished pages return 404 on live routes.
- Preview token is validated using `PREVIEW_SECRET` (fallback `STRAPI_PREVIEW_TOKEN`).
- Strapi admin preview handler builds URLs to `/api/preview?...` with `status` so Draft/Published toggle reflects correctly.

## Layout + Renderer
- `packages/layouts/src/index.ts` exports `LayoutRegistry`.
- page rendering selects layout by `layoutKey` from validated page contract.
- `packages/renderer` validates each block via schema.
- Preview mode can render invalid block diagnostics; non-preview mode fails safe.

## Navigation Requirements
- Navigation key enum: `main | footer`
- Items support grouped children depth `<= 2`
- Site header/footer render from CMS navigation entries

## Data Access Policy (GraphQL)
- `services/strapi/config/plugins.js` enables GraphQL plugin at `/graphql`.
- `packages/integrations/src/strapiClient.ts` is the typed integration layer for pages/navigation/blogs.
- Reads for pages/navigation/blogs MUST use GraphQL, not REST.
- Integration supports Strapi v5 queries (`status`, flat nodes with `documentId`) and keeps v4 compatibility fallback logic.

## Blogs Dual-Access + Canonical
- `apps/site`: `/blogs`, `/blogs/[slug]`
- `apps/blogs`: `/`, `/[slug]`
- Canonical base controlled by `BLOG_CANONICAL_BASE` (default `https://lmnas.com/blogs`)
- Canonical must resolve to lmnas.com blogs base even when served from blogs app

## Rudder Consistency
- Shared analytics module: `packages/analytics/src/index.ts`
- apps import `@lmnas/analytics` (site + blogs)
- cookie domain strategy: `RUDDER_COOKIE_DOMAIN=.lmnas.com`

## Seed Requirements
Bootstrap data includes:
- Pages: `home`, `products/cpq`, `solutions/tender-intelligence`, `about`
- Navigation: `main`, `footer`
- Blog post: `phase-0-baseline`

## Required Tests / Guardrails
Required coverage includes:
- contracts validation (`packages/contracts/src/contracts.test.ts`)
- integrations GraphQL parsing and publication status behavior (`packages/integrations/src/strapiClient.test.ts`)
- site route slug resolution (`apps/site/app/page.test.tsx`, `apps/site/app/[...slug]/page.test.tsx`)
- preview session behavior (`apps/site/app/api/preview/route.test.ts`)
- blog route behavior (`apps/site/app/blogs/*.test.ts`, `apps/blogs/app/[slug]/page.test.ts`)
- layout registry (`packages/layouts/src/layouts.test.ts`)
- seo canonical behavior (`packages/seo-engine/src/seo.test.ts`)
- analytics shared-module adoption (`packages/analytics/src/adoption.test.ts`)
- lint boundary guardrails (`packages/eslint-config/boundaries.test.ts`)
- `/api/health` (`apps/site/app/api/health/route.test.ts`)

ESLint guardrails enforce:
- no app `src/components/**`
- no direct external API clients from apps
- no `@lmnas/integrations/*` subpath imports in apps
- no direct fetch to `/api/pages|navigations|blog-posts` from apps
- blocks must be pure (no fetch)
- zod imports restricted to contracts and block schema files

## Acceptance Checklist
1. `pnpm install`
2. `cp .env.example .env`
3. `docker compose up -d`
4. `pnpm dev`
5. Verify routes: `/`, `/products/cpq`, `/solutions/tender-intelligence`, `/about`, `/blogs`, `/blogs/[slug]`, `/api/health`
6. Verify preview:
   - direct: `/preview?slug=about&token=...`
   - Strapi admin preview button (Draft and Published toggle)
7. Validate live vs preview behavior:
   - live shows published snapshot
   - preview shows draft edits
8. `pnpm lint`
9. `pnpm typecheck`
10. `pnpm test`
