# Codex Scaffold Spec v1

## Document Metadata
- Name: `Codex Scaffold Spec v1`
- Product: `LMNAs Turbo v2`
- Platform baseline: `Platform Spec v1`
- Scope: monorepo scaffold for local-first, block-based website platform

## Purpose
This spec defines the required architecture, constraints, and verification criteria for scaffolding LMNAs Turbo v2.

It is the source of truth for:
- what must exist in the scaffold
- what must boot locally
- what guardrails prevent architectural drift

## Non-negotiable Outcomes
After scaffold completion, a developer must be able to run:
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
- demo page rendered via block renderer
- Strapi preview URL flow route working (stub/local-friendly token behavior allowed)
- boundaries enforced to prevent drift

## Architecture Overview

### Apps
- `apps/site` (required): `lmnas.com`
- `apps/docs` (required): `docs.lmnas.com`
- `apps/blogs` (required): `blogs.lmnas.com`
- `apps/gateway` (optional): placeholder only; rewrite intent documented

### Packages
- `packages/blocks`
- `packages/block-registry`
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

## Guardrails and Boundaries
1. No reusable components in apps:
- `apps/*/src/components/**` is forbidden.

2. Apps must not call external APIs directly:
- apps only use platform APIs through `@lmnas/integrations` or `@lmnas/renderer` entrypoints.

3. Zod schema location restriction:
- allowed only in:
  - `packages/contracts/**`
  - `packages/blocks/*/schema.ts`

4. Block purity:
- blocks are pure render units.
- blocks must not fetch data.

5. Integration layer scope:
- integrations only adapt transport and validate contracts.
- no business logic in integrations.

## Hello Platform Demo Requirements

### Strapi
- collection type: `Page`
- fields:
  - `slug` (unique string)
  - `blocks` dynamic zone with:
    - `hero`
    - `faq`
  - SEO component fields:
    - `metaTitle`
    - `metaDescription`
    - `canonical`
    - `robots`
- seed one page:
  - `slug = home`
  - includes Hero + FAQ blocks

### Site App
- `/` renders slug `home` via renderer
- `/preview?slug=home&token=...` route exists and renders preview mode
- `/api/health` returns service health JSON

### Blocks + Renderer
- required blocks:
  - Hero
  - FAQ
- each block folder must include:
  - `Component.tsx`
  - `schema.ts`
  - `defaults.json`
  - `mock.ts`
  - `index.ts`
- renderer behavior:
  - validate each block against registry schema
  - render in order
  - invalid block handling:
    - preview: render validation error UI with path
    - production: skip block safely with placeholder/no crash

### SEO Engine
- `buildSeo(page): { meta, jsonLd }`
- produce FAQPage JSON-LD if FAQ block exists

### Integrations
- `strapiClient.getPageBySlug(slug, { preview? })`
- `analytics.track(eventName, payload)` local no-op
- `lens` client to local mock endpoint

### Contracts
- union schemas for Hero + FAQ blocks
- Page schema includes `blocks[]`
- Strapi response schemas

### Local Mocks
- lens mock:
  - `GET /appointments`
  - deterministic JSON
- rudder mock:
  - `POST /track`
  - logs payload and returns `200`

## Services and Docker Compose Requirements
Compose must define explicit ports for:
- Postgres
- Strapi
- n8n
- lens-api mock
- rudder mock

Ports must match `.env.example` defaults.

## Required Tests
Use Vitest and include at minimum:
1. renderer valid block render test
2. schema/preview invalid FAQ validation error behavior test
3. SEO engine FAQPage JSON-LD test

## Acceptance Checklist
- `pnpm install` succeeds
- `docker compose up -d` succeeds
- `pnpm dev` starts site
- `/` renders blocks
- `/preview` route works
- `/api/health` works
- renderer skips invalid blocks safely
- lint guardrails enforce boundaries
- `pnpm test` passes
- `pnpm lint` passes
- `pnpm typecheck` passes

## Diff-friendly

### What Changed From Previous Version
- v1 baseline.
- no previous version.

### Implementation Notes
- Keep file paths deterministic.
- Keep prompts self-contained.
- When evolving to v1.1+, update this section first, then prompt.
- Never relax guardrails without explicit version bump and rationale.

## Versioning and Evolution
- Current version: `v1`
- Minor updates: `v1.1`, `v1.2` for additive clarifications
- Major updates: `v2` for architecture or guardrail changes

Version update process:
1. update `SCaffold_Spec_vX.md`
2. regenerate `Scaffold_Prompt_vX.md`
3. update `docs/codex/README.md`
4. run lint/test/typecheck checks after scaffold updates
