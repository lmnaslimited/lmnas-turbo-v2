# Codex Scaffold Prompt v1.1

You are Codex acting as a senior staff engineer. Your task is to scaffold a WORKING Turborepo monorepo matching the updated Phase 0 stabilization spec.

## Non-negotiable Outcome
Upon completion:
- project boots
- Strapi preview works
- `/api/health` exists
- conversionConfig is enforced
- SEO validation exists
- architectural boundaries hold

If anything fails, fix it. Do not leave TODOs.

## Tech Choices
(Node 20, pnpm, Next.js App Router, TypeScript, Strapi v4, Postgres, n8n, zod, vitest)

## Architecture
(As defined in updated Spec v1.1)

## Phase 0 Stabilization
- Add page conversionConfig requirement
- Enforce via Zod + rendering validation
- Add health endpoint
- Expand ESLint guardrails
- Add conversionConfig lint rule

## Blocks
(Hero + FAQ)

## SEO Engine
- Meta tags
- JSON-LD formats

## Tests
- Renderer
- SEO
- conversion
- ESLint boundaries
- Health

## Acceptance Checklist
- `pnpm install`
- `docker compose up -d`
- `pnpm dev`
- `/`
- `/preview`
- `/api/health`
- ConversionConfig validation
- Lint pass
- Tests pass

Proceed to generate the scaffold.
