# Codex Scaffold Prompt v1.1

You are Codex acting as a senior staff engineer.
Your task is to scaffold a WORKING Turborepo monorepo matching Constitution v2.1 Phase 0 baseline requirements.

This prompt defines Phase 0 only.

Out of scope for this run:
- Router engine
- Identity model
- Personalization

## Non-negotiable Outcome
Upon completion:
- project boots
- Strapi preview works
- `/api/health` exists
- conversionConfig is enforced
- CMS-driven dynamic routing works
- layout registry works
- CMS navigation works
- GraphQL integration is used for pages/navigation/blogs
- dual-access blog routing + canonical strategy works
- Rudder consistency across apps is enforced
- SEO validation exists
- architectural boundaries hold

If anything fails, fix it. Do not leave TODOs.

## Tech Choices
(Node 20, pnpm, Next.js App Router, TypeScript, Strapi v4, Postgres, n8n, zod, vitest)

## Deterministic Architecture Requirements
Implement exactly with these paths:
- `apps/site/app/page.tsx` for `/` -> CMS slug `home`
- `apps/site/app/[...slug]/page.tsx` for joined CMS slugs
- `apps/blogs/app/page.tsx` for `/`
- `apps/blogs/app/[slug]/page.tsx` for `/[slug]`
- `packages/layouts/src/index.ts` exporting `LayoutRegistry`
- `packages/integrations/src/` typed GraphQL clients for pages/navigation/blogs
- `packages/contracts/src/index.ts` containing required page/nav/blog contracts
- `services/strapi/src/api/page/content-types/page/schema.json`
- `services/strapi/config/plugins.js` with GraphQL plugin enabled

## Phase 0 Stabilization
Required:
- Page contract includes required:
  - `pageType` enum
  - `layoutKey` enum
  - `conversionConfig` (`primary`, `product`, `industry`)
- Conversion config enforced by Zod contracts and integration parsing.
- Dynamic routing implemented for `/` and `/[...slug]`.
- Layout rendering flows through `LayoutRegistry` in `packages/layouts`.
- Navigation content type supports:
  - `key`: `main | footer`
  - grouped items with depth `<= 2`
- Site header/footer rendered from CMS navigation content.
- GraphQL used for pages/navigation/blogs with typed integration responses.
- REST must not be used for pages/navigation/blogs reads.
- Dual-access blogs implemented:
  - `apps/site`: `/blogs`, `/blogs/[slug]`
  - `apps/blogs`: `/`, `/[slug]`
  - canonical URL base controlled by `BLOG_CANONICAL_BASE`
  - canonical points to `lmnas.com/blogs/...`
- Rudder tracking consistency enforced across apps, including cookie-domain strategy documentation.
- `/api/health` implemented and tested.

## Blocks
(Hero + FAQ)

## SEO Engine
- Meta tags
- JSON-LD formats

## Seed Data Requirements
Seed CMS content for:
- `home`
- `products/cpq`
- `solutions/tender-intelligence`
- `about`
- navigation `main`
- navigation `footer`
- one blog post

## Validation Requirements
Must pass:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

Required test coverage includes:
- renderer block validation
- SEO JSON-LD
- conversionConfig enforcement
- dynamic route slug resolution
- layout registry resolution
- GraphQL integration parsing for pages/navigation/blogs
- blog canonical behavior for `apps/site` and `apps/blogs`
- Rudder consistency checks
- ESLint boundary/guardrail checks
- `/api/health`

## Acceptance Checklist
- `pnpm install`
- `docker compose up -d`
- `pnpm dev`
- `/`
- `/products/cpq`
- `/solutions/tender-intelligence`
- `/about`
- `/blogs`
- `/blogs/[slug]`
- `/api/health`
- Strapi admin preview works for unpublished content
- ConversionConfig validation
- GraphQL-only reads for pages/navigation/blogs
- CMS navigation in header/footer
- blog canonical base behavior is correct
- Rudder cross-app consistency is verified
- `pnpm lint` passes
- `pnpm typecheck` passes
- `pnpm test` passes

Proceed to generate the scaffold.
