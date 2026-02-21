# Codex Scaffold Prompt v1.1-final (Phase 0 Baseline Upgrade)

You are Codex acting as a senior staff engineer.
Your task is to baseline the current Turborepo scaffold to match Operating Constitution v2.1 Phase 0 requirements.

Scope = Phase 0 only.
Out of scope:
- Router engine
- Identity model
- Personalization

## Non-negotiable Outcome
Upon completion:
- project boots locally
- Strapi preview works (including draft/unpublished preview via /preview route)
- `/api/health` exists and returns service status
- conversionConfig is enforced for every CMS Page
- CMS-driven dynamic routing works for / and /[...slug]
- layout registry works (pageType/layoutKey)
- CMS navigation works (header/footer driven from Strapi)
- GraphQL integration is used for pages/navigation/blogs reads (REST not used for these reads)
- dual-access blog routing + canonical strategy works
- Rudder consistency across apps is enforced (shared module + env + cookie strategy documented)
- SEO validation exists (meta + JSON-LD)
- architectural boundaries hold (no drift)

If anything fails, fix it. Do not leave TODOs.

## Tech Choices
Node 20, pnpm, Next.js App Router, TypeScript, Strapi v4, Postgres, n8n, zod, vitest.

## Deterministic Architecture Requirements (paths must match)
### Site routes
- `apps/site/app/page.tsx` -> `/` renders CMS slug `home`
- `apps/site/app/[...slug]/page.tsx` -> `/<...slug>` renders CMS slug joined by `/` (e.g. products/cpq)
- `apps/site/app/preview/page.tsx` -> `/preview?slug=...&token=...` renders draft preview content
- `apps/site/app/blogs/page.tsx` -> `/blogs` blog list
- `apps/site/app/blogs/[slug]/page.tsx` -> `/blogs/[slug]` blog detail
- `apps/site/app/api/health/route.ts` -> `/api/health`

### Blogs app routes (alias domain)
- `apps/blogs/app/page.tsx` -> `/` blog list
- `apps/blogs/app/[slug]/page.tsx` -> `/<slug>` blog detail

### Packages
- `packages/layouts/src/index.ts` exporting `LayoutRegistry`
- `packages/integrations/src/` typed GraphQL clients for pages/navigation/blogs
- `packages/contracts/src/index.ts` containing required Page/Navigation/Blog contracts (Zod)
- `packages/seo-engine/src/` SEO builder supporting BLOG_CANONICAL_BASE
- `packages/analytics/src/index.ts` (NEW) shared Rudder client wrapper used by apps/site and apps/blogs

### Strapi schemas/config (deterministic)
- `services/strapi/src/api/page/content-types/page/schema.json`
- `services/strapi/src/api/navigation/content-types/navigation/schema.json`
- `services/strapi/src/api/blog-post/content-types/blog-post/schema.json` (use this exact API name: blog-post)
- `services/strapi/config/plugins.(js|ts)` with GraphQL plugin enabled

## Phase 0 Stabilization Requirements
1) Page contract must include required:
   - `pageType` enum: home|product|solution|industry|simple
   - `layoutKey` enum: homeLayout|productLayout|solutionLayout|industryLayout|simpleLayout
   - `conversionConfig` required:
     - primary: book|benefit|download|subscribe
     - product: string
     - industry: string

2) Conversion config enforced by:
   - Zod contracts
   - integration parsing
   - preview shows editor-friendly error
   - production fails safe (no crash, return 404 or safe fallback)

3) Dynamic routing implemented for `/` and `/[...slug]` using CMS slug join convention.

4) Layout rendering must flow through `LayoutRegistry` and differ by layoutKey (shell differences allowed).

5) Navigation content type supports:
   - `key`: main|footer
   - items supporting group-with-children (depth <=2)
   - header/footer must render from CMS navigation

6) GraphQL used for pages/navigation/blogs reads with typed integration responses.
   REST must not be used for these reads.

7) Dual-access blogs implemented:
   - `apps/site`: `/blogs`, `/blogs/[slug]`
   - `apps/blogs`: `/`, `/[slug]`
   - canonical URL base controlled by env `BLOG_CANONICAL_BASE` (default `https://lmnas.com/blogs`)
   - canonical must always point to lmnas.com/blogs even on blogs app.

8) Rudder tracking consistency:
   - both apps import `@lmnas/analytics`
   - shared env vars (write key, data plane URL if used)
   - document cookie-domain strategy `.lmnas.com` in README
   - add a lightweight test that both apps reference the shared analytics module

9) `/api/health` implemented and tested.

## Seed Data Requirements
Seed CMS content for:
- Pages: `home`, `products/cpq`, `solutions/tender-intelligence`, `about`
- Navigation: `main` with groups Products/Solutions/Industries + children links, and `footer`
- BlogPost: one blog post

## Validation Requirements
Must pass:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

Tests must cover:
- renderer block validation
- SEO JSON-LD (FAQPage + Blog Article minimal)
- conversionConfig enforcement
- dynamic route slug resolution
- layout registry resolution
- GraphQL integration parsing for pages/navigation/blogs
- blog canonical behavior for `apps/site` and `apps/blogs`
- shared analytics module usage
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
- Strapi admin preview works for unpublished content via `/preview?slug=...&token=...`
- GraphQL-only reads for pages/navigation/blogs
- CMS navigation in header/footer
- blog canonical base behavior correct
- Rudder cross-app consistency verified
- `pnpm lint` passes
- `pnpm typecheck` passes
- `pnpm test` passes

Proceed to implement Phase 0 baseline upgrade now.
