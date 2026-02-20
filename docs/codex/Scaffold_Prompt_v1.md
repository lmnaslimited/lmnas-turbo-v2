# Codex Scaffold Prompt v1 — LMNAs Turbo v2 Website Platform (Monorepo + Local-first + Block-based)

You are Codex acting as a senior staff engineer. Your job is to scaffold a WORKING Turborepo monorepo that matches the architecture and platform spec below.

## Non-negotiable outcome
After scaffolding, a developer must be able to:
1. `git clone ...`
2. `pnpm install`
3. `cp .env.example .env`
4. `docker compose up -d`
5. `pnpm dev`

…and have:
- Next.js site running
- Strapi running
- n8n running
- mocks running
- a demo page rendered via Block Renderer
- Strapi “Preview” URL flow working (stubbed if needed, but route exists)
- strict boundaries enforced so drift cannot restart

If anything doesn’t run, fix it in the scaffold. Do not leave TODOs that prevent booting.
Do not leave pseudo-code. Produce runnable code.

---

## Tech choices for scaffold (defaults)
- Node: 20
- Package manager: pnpm
- Monorepo: Turborepo
- Framework: Next.js (App Router)
- Language: TypeScript
- Strapi: v4
- DB: Postgres (docker compose)
- n8n: docker image
- Validation: zod
- Testing: vitest
- Mocking: MSW (node) for integration tests + simple express mocks for local endpoints

---

## Architecture to implement

### Apps
- `apps/site` -> `lmnas.com`
- `apps/docs` -> `docs.lmnas.com`
- `apps/blogs` -> `blogs.lmnas.com`
- `apps/gateway` (optional): placeholder app + README rewrite guidance; not required for boot

### Packages
- `packages/blocks`
- `packages/block-registry`
- `packages/renderer`
- `packages/seo-engine`
- `packages/contracts`
- `packages/integrations`
- `packages/testkit`
- `packages/eslint-config` (custom boundary rules)

### Services
- `services/strapi`
- `services/n8n` (versioned workflows folder + README)
- `services/mocks` (lens-api + rudder capture as lightweight express apps)
- `infra/docker-compose.yml`

---

## Critical guardrails (must enforce via ESLint boundaries)
1. Apps must NOT contain reusable components directory:
- disallow `apps/*/src/components/**`

2. Apps must NOT call external APIs directly:
- block direct API client usage for Strapi/n8n/LENS/Rudder in apps
- apps may only use `@lmnas/integrations` or `@lmnas/renderer` public entrypoints

3. Zod schemas live ONLY in:
- `packages/contracts`
- `packages/blocks/*/schema.ts`

4. Blocks do not fetch data:
- blocks are pure components

5. Integrations do not contain business logic:
- integrations only adapt transport and validate contracts

---

## Working “Hello Platform” demo requirements

### Strapi
Create minimal Strapi project in `services/strapi` with:
- `Page` content type:
  - `slug` (string, unique)
  - `blocks` dynamic zone with:
    - Hero block component
    - FAQ block component
  - SEO fields:
    - `metaTitle`
    - `metaDescription`
    - `canonical`
    - `robots`
- bootstrap/seed so one page exists:
  - slug = `home`
  - contains Hero + FAQ blocks

If remote/content API fails, provide local fixture fallback for rendering, but Strapi itself must still boot.

### Next.js site app
In `apps/site`:
- `/` renders slug `home` from Strapi through renderer
- `/preview` accepts `?slug=home&token=...` and renders preview content
- `/api/health` returns health JSON

### Blocks + renderer
Provide 2 blocks:
- Hero
- FAQ

Each block in `packages/blocks/<BlockName>/` includes:
- `Component.tsx`
- `schema.ts`
- `defaults.json`
- `mock.ts`
- `index.ts`

`packages/block-registry` exports:
- `hero` -> Hero component + schema
- `faq` -> FAQ component + schema

`packages/renderer`:
- accepts page data
- validates each block by zod schema
- renders blocks in order
- invalid block behavior:
  - preview mode: render error UI with failing field path
  - production mode: skip block with safe placeholder, no crash

### SEO engine
`packages/seo-engine`:
- expose `buildSeo(page): { meta, jsonLd }`
- generate FAQPage JSON-LD when FAQ block exists

### Integrations
`packages/integrations` includes:
- `strapiClient.getPageBySlug(slug, { preview? }): Promise<Page>`
  - uses `STRAPI_URL`
  - validates response with contracts
- `analytics.track(eventName, payload)` local no-op
- `lens` client calling local mock endpoint

### Contracts
`packages/contracts` defines:
- block union schema: HeroBlock | FAQBlock
- Page schema with `blocks[]`
- Strapi response schemas

### Local mocks
- `services/mocks/lens-api`:
  - express server
  - `GET /appointments` deterministic JSON
- `services/mocks/rudder`:
  - express server
  - `POST /track` log + 200 response

### Docker compose
In `infra/docker-compose.yml`:
- Postgres
- Strapi (connected to Postgres)
- n8n
- lens-api mock
- rudder mock

Ports explicit and mirrored in `.env.example`.

---

## Tooling requirements
- root pnpm workspace config
- `turbo.json` tasks:
  - `dev`
  - `build`
  - `lint`
  - `test`
- root scripts:
  - `pnpm dev`
  - `pnpm test`
  - `pnpm lint`
  - `pnpm typecheck`

---

## Tests (must be included and passing)
1. renderer test: valid block data renders
2. schema validation test: invalid FAQ fails with helpful preview error path
3. SEO engine test: FAQ block produces FAQPage JSON-LD

Use Vitest.

---

## Documentation requirements
Create root `README.md` with:
- local boot instructions
- folder purpose
- guardrails
- how to add a new block
- Codex new-block generation placeholder
- preview behavior

Create `CONTRIBUTING.md` with:
- no components in apps
- apps cannot call integrations directly
- blocks are pure

---

## Deliverables
Generate all files needed to run.
Output must include:
- full folder tree and configs
- app/package/service code
- docker compose + env example
- Strapi project skeleton under `services/strapi`

Must boot locally. No pseudo-code.

---

## Acceptance checklist
- `pnpm install` works
- `docker compose up -d` works
- `pnpm dev` starts and site home renders blocks
- renderer safely skips invalid blocks in production mode
- preview route exists and renders validation errors
- ESLint guardrails enforce architecture boundaries
- tests pass
- lint and typecheck pass

---

## Diff-friendly

### What Changed From Previous Version
- v1 baseline.
- no previous version.

### Implementation Notes
- Keep this prompt deterministic and path-specific.
- Keep it aligned with `docs/codex/SCaffold_Spec_v1.md`.
- Update acceptance checklist and guardrails first when evolving to next version.
