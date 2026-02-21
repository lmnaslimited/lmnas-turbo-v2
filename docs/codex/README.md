# Codex Scaffold Docs

## What These Docs Are
This folder stores reusable, versioned scaffold documents for `LMNAs Turbo v2`:
- spec document: canonical platform requirements
- prompt document: copy/paste instruction set for Codex runs

Current baseline files:
- `SCaffold_Spec_v1.md`
- `SCaffold_Spec_v1.1.md`
- `Scaffold_Prompt_v1.md`
- `Scaffold_Prompt_v1.1.md`

## Files
- `SCaffold_Spec_v1.md`: legacy scaffold architecture/constraints
- `SCaffold_Spec_v1.1.md`: Phase 0 stabilization requirements aligned to current implementation
- `Scaffold_Prompt_v1.md`: legacy deterministic prompt
- `Scaffold_Prompt_v1.1.md`: Phase 0 implementation prompt

## Phase 0 Stabilization (Constitution v2.1)
Phase 0 is the mandatory baseline for production-safe scaffolding.

Phase 0 includes:
- Strapi v5 CMS + GraphQL plugin
- page contract enforcement (`pageType`, `layoutKey`, required `conversionConfig`)
- CMS-driven dynamic page routing (`/` + `/[...slug]`)
- layout selection via `LayoutRegistry`
- CMS-driven navigation (`main` and `footer`)
- GraphQL integration layer for pages/navigation/blogs (no REST reads for these)
- preview workflow with token validation and draft-mode session routing
- live vs preview publication behavior (published-only live, draft preview)
- dual-access blogs + canonical base (`BLOG_CANONICAL_BASE`)
- Rudder shared module and cookie strategy (`RUDDER_COOKIE_DOMAIN=.lmnas.com`)
- `/api/health` and test/lint/typecheck gate

Phase 0 explicitly does not include:
- Router engine
- Identity model
- Personalization

Phase 0 must pass completely before Phase 1 work begins.

## How to Run Codex with the Prompt
1. Open `docs/codex/Scaffold_Prompt_v1.1.md`.
2. Copy the full prompt content.
3. Run Codex in repo root and paste prompt.
4. Require full validation:
- `pnpm install`
- `docker compose up -d`
- `pnpm dev`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## How to Update Spec/Prompt Safely
1. Verify current implementation first (paths, env vars, tests).
2. Update spec first.
3. Mirror changes in prompt.
4. Keep acceptance checklist in sync with actual scripts and routes.
5. Avoid introducing Phase 1+ architecture into v1.1 docs.

## Common Failure Modes
- Strapi is up but GraphQL queries use wrong publication arguments.
- Preview token mismatch between site and Strapi admin config.
- Admin preview opens a URL that does not set draft session state.
- Guardrails drift and apps bypass `@lmnas/integrations`.
