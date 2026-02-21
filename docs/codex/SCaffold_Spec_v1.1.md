# Codex Scaffold Spec v1.1

## Document Metadata
- Name: `Codex Scaffold Spec v1.1`
- Platform baseline: `LMNAs Platform Operating Constitution v2.1`
- Scope: Turborepo local-first, CMS-driven web platform scaffold with explicit Phase 0 stabilization gate.

## Purpose
Defines full scaffold requirements for the Constitution v2.1 Phase 0 baseline.

## Non-negotiable Outcomes
After scaffold, developer must run:

1. `git clone ...`
2. `pnpm install`
3. `cp .env.example .env`
4. `docker compose up -d`
5. `pnpm dev`

And obtain:

- Next.js site running
- Strapi running
- n8n running
- local mocks running
- demo pages rendered via block renderer and layout registry
- Strapi preview working
- `/api/health` endpoint working
- no crash on invalid content
- architectural guardrails enforced

## Phase 0 Stabilization Gate (Mandatory)
Phase 0 is a hard gate. All items in this spec MUST pass before any Phase 1+ work.

Explicitly out of scope for Phase 0:
- Router engine
- Identity model
- Personalization

If any Phase 0 requirement fails, scaffold is incomplete.

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
- `packages/testkit`
- `packages/eslint-config`

### Services
- `services/strapi`
- `services/n8n`
- `services/mocks`
- `infra/docker-compose.yml`

## Routing Model (CMS-Driven)
- `apps/site/app/page.tsx` resolves CMS slug `home`.
- `apps/site/app/[...slug]/page.tsx` resolves joined slug path.
  - Example: `/products/cpq` -> `products/cpq`
  - Example: `/solutions/tender-intelligence` -> `solutions/tender-intelligence`
- Route rendering must consume validated CMS page contracts.

## Content Model Requirements
### Page
`services/strapi/src/api/page/content-types/page/schema.json` MUST include:
- `slug` (unique string)
- `pageType` enum (required)
- `layoutKey` enum (required)
- `conversionConfig` component (required):
  - `primary`: `book | benefit | download | subscribe`
  - `product`: `string`
  - `industry`: `string`
- `blocks` dynamic zone
- `seo` component

### Navigation
Dedicated content type for CMS navigation is required.
- `key` enum: `main | footer`
- grouped items with max depth `<= 2`
- site header/footer MUST be CMS-driven from this model

## Layout System
- `packages/layouts` is required.
- `LayoutRegistry` maps `layoutKey` -> layout component.
- Site page renderer must select layout via `layoutKey` from validated page contract.

## Data Access and API Policy
- GraphQL plugin is required in Strapi.
- `packages/integrations` MUST expose typed GraphQL clients for:
  - pages
  - navigation
  - blogs
- REST MUST NOT be used for pages/navigation/blogs reads.
- REST usage for unrelated operational endpoints is allowed only if outside the above domains.

## Blogs Dual-Access Architecture
- Canonical base is controlled by `BLOG_CANONICAL_BASE`.
- `apps/site` exposes:
  - `/blogs`
  - `/blogs/[slug]`
- `apps/blogs` exposes:
  - `/`
  - `/[slug]`
- Canonical URL for every blog page MUST point to `https://lmnas.com/blogs/...` (or equivalent lmnas.com base from config), regardless of serving app.

## Rudder Consistency Requirements
- Rudder tracking plan and event naming must be consistent across `apps/site`, `apps/docs`, and `apps/blogs`.
- Cookie domain strategy must be documented and shared so cross-app attribution remains stable.
- No app-specific divergence in core page-view and conversion events.

## Phase 0 Stabilization Requirements
1. **Conversion Config Enforcement**
   - Every page MUST include required `conversionConfig`.
   - Zod contracts and integration parsing MUST enforce this.
   - Missing/invalid conversion config MUST fail validation.

2. **Renderer Validation**
   - Validate each block via schema.
   - Invalid blocks must:
     - In preview: show error UI
     - In production: skip safely

3. **SEO Requirements**
   - Meta title, description, canonical, robots required
   - No duplicate meta tags
   - JSON-LD valid for FAQPage, Article, VideoObject

4. **Health Endpoint**
   - `/api/health` returns OK

5. **ESLint Guardrails**
   - No reusable components in apps
   - No external API calls from apps
   - No direct integration subpath imports from apps
   - No direct REST fetches for pages/navigation/blogs
   - Pages without conversionConfig fail lint

6. **Preview**
   - Strapi admin preview opens site preview and unpublished content renders safely.

## Seed Requirements
Initial CMS seed data MUST include:
- page slug `home`
- page slug `products/cpq`
- page slug `solutions/tender-intelligence`
- page slug `about`
- navigation `main`
- navigation `footer`
- one blog post

## Tests Required
- Renderer block validation tests
- FAQ JSON-LD test
- ConversionConfig enforcement tests
- dynamic route slug resolution tests (`/` and `/[...slug]`)
- layout registry resolution tests
- GraphQL integration parsing tests for pages/navigation/blogs
- guardrail tests that block REST usage for pages/navigation/blogs
- blog canonical tests for both `apps/site` and `apps/blogs`
- navigation rendering tests for CMS header/footer
- Rudder consistency tests across apps
- ESLint boundary tests
- `/api/health` test

## Acceptance Checklist
- `pnpm install` succeeds
- Docker compose boots all services
- Site renders `/` from slug `home`
- Site renders `/products/cpq`, `/solutions/tender-intelligence`, `/about` via dynamic `[...slug]`
- `packages/layouts` and `LayoutRegistry` are used for page rendering
- CMS-driven header/footer navigation works from `main` and `footer` keys
- Strapi GraphQL plugin enabled and typed integrations in use
- REST not used for pages/navigation/blogs
- Dual-access blogs routes work in `apps/site` and `apps/blogs`
- Blog canonicals resolve to `lmnas.com/blogs/...` base
- Rudder events remain consistent across apps with documented cookie-domain strategy
- Preview route is working from Strapi admin
- `/api/health` works
- `pnpm lint` passes
- `pnpm typecheck` passes
- `pnpm test` passes

## Versioning
- Spec version: `v1.1`
- Minor changes: bump patch
- Major changes: bump major
