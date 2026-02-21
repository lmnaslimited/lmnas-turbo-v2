# Codex Scaffold Spec v1.1

## Document Metadata
- Name: `Codex Scaffold Spec v1.1`
- Platform baseline: `Platform Spec v1 + Phase 0 Stabilization`
- Scope: Turborepo local-first, block-based website platform with Phase 0 stability criteria.

## Purpose
Defines full scaffold requirements including Phase 0 stabilization constraints.

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
- demo page rendered via block renderer
- Strapi preview working
- `/api/health` endpoint working
- no crash on invalid content
- architectural guardrails enforced

## Architecture Overview
### Apps
- `apps/site`
- `apps/docs`
- `apps/blogs`
- `apps/gateway` (optional placeholder)

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

## Phase 0 Stabilization Requirements
1. **Conversion Config Enforcement**
   - Every page MUST include:
     ```ts
     conversionConfig: {
       primary: "book" | "benefit" | "download" | "subscribe",
       product: string,
       industry: string
     }
     ```
   - Scaffold should include Zod validation for this.

2. **Renderer Validation**
   - Validate each block via schema.
   - Invalid blocks must:
     - In preview: show error UI
     - In production: skip safely

3. **SEO Requirements**
   - Meta title, description, canonical, robots required
   - No duplicate meta tags
   - JSON-LD valid for FAQPage, Article, VideoObject

4. **Health Endpoints**
   - `/api/health` returns OK

5. **ESLint Guardrails**
   - No reusable components in apps
   - No external API calls from apps
   - Pages without conversionConfig fail lint
   - Product/problem pages without benefit mapping fail lint

6. **Phase 0 Gate**
   - Spec must include a stabilization gate
   - Further phases require Phase 0 criteria satisfied

## Hello Platform Demo Requirements
(Strapi, blocks, renderer requirements remain as v1 with new validation)

## Tests Required
- Renderer block validation tests
- FAQ JSON-LD test
- ConversionConfig enforcement tests
- ESLint boundary tests
- `/api/health` test

## Acceptance Checklist
- `pnpm install` succeeds
- Docker compose boots all services
- Site renders homepage with blocks
- Preview route is working
- `/api/health` works
- Lint and typecheck pass
- Tests pass

## Versioning
- Spec version: `v1.1`
- Minor changes: bump patch
- Major changes: bump major
