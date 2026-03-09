# LMNAs Website Operating System (Turbo v2)

UI-first, governed website platform for LMNAs.

Core stack: Next.js + Strapi + n8n + Rudder.

## Fastest Operator Path

1. Start stack
- `pnpm install`
- `cp .env.example .env`
- `docker compose up -d`
- `pnpm dev`

2. Open onboarding studio
- `http://localhost:3000/platform/onboarding`

3. Use the visual wizard
- Source Intake
- Source Preview
- Detection Review (import/skip)
- Selection & Mapping
- Action Mapping
- Publish Summary

No manual env export is required for normal local onboarding flow when `.env` / `.env.local` are present.

## Platform Objects

- Shells: navbar/footer/utility/announcement
- Blocks: reusable content sections
- Widgets: modal/drawer/form/chat/download/booking surfaces
- Actions: CTA behavior bindings
- Exits: backend/business workflow contracts

## Guardrails

- Constitution v2.1 is authoritative: `docs/architecture/LMNAs_Platform_Operating_Constitution_v2_1.md`
- Strapi is source of truth
- Blocks are pure UI
- Schema-first contracts
- Integrations via adapters
- n8n orchestration + Rudder events
- CLI onboarding is fallback only (CI/debug/batch)

## Key Routes

- Site: `http://localhost:3000`
- Onboarding: `http://localhost:3000/platform/onboarding`
- Analyze API: `POST /api/platform/onboarding/analyze`
- Publish API: `POST /api/platform/onboarding/publish`
- Exit runtime API: `POST /api/platform/exits/execute`

## Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`
- `pnpm test:e2e:real`

## Docs

- `docs/platform/vision.md`
- `docs/platform/operator-manual.md`
- `docs/platform/onboarding-workflow.md`
- `docs/platform/shell-system.md`
- `docs/platform/block-model.md`
- `docs/platform/exit-architecture.md`
- `docs/platform/theme-model.md`
- `docs/platform/developer-implementation.md`
- `docs/platform/migration-plan.md`
