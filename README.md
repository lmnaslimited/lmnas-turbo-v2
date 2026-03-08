# LMNAs Website Operating System (Turbo v2)

UI-first, governed website platform for LMNAs built on Next.js + Strapi + n8n.

## Fastest Operator Path

1. Start stack:
   - `pnpm install`
   - `cp .env.example .env`
   - `docker compose up -d`
   - `pnpm dev`
2. Open onboarding console:
   - `http://localhost:3000/platform/onboarding`
3. Run workflow:
   - Source intake -> analysis -> confirmation -> publish dry run/apply

## Platform Model

The canonical runtime model has 5 layers:

1. Shell Layer
- Navbar/footer/menus/submenus/variants

2. Block Layer
- Canonical reusable block families with structured fields

3. Page Assembly Layer
- Shell assignment + ordered blocks + footer variant

4. Exit Layer
- Governed business interactions bound by `exitId`

5. Execution Layer
- Adapter runtime + n8n workflows + Rudder events

## Guardrails

- Constitution v2.1 is authoritative: `docs/architecture/LMNAs_Platform_Operating_Constitution_v2_1.md`
- Strapi is source of truth for governed content
- Blocks are pure UI
- Schema-first contracts
- Policy A allowlist for block rendering
- Integrations through adapters
- n8n central orchestration
- Rudder unified event stream

## Key Routes

- Site: `http://localhost:3000`
- Onboarding console: `http://localhost:3000/platform/onboarding`
- Analyze API: `POST /api/platform/onboarding/analyze`
- Publish API: `POST /api/platform/onboarding/publish`
- Exit runtime API: `POST /api/platform/exits/execute`
- Health: `GET /api/health`

## Docs

- Platform vision: `docs/platform/vision.md`
- Operator guide: `docs/platform/operator-manual.md`
- Onboarding workflow: `docs/platform/onboarding-workflow.md`
- Shell system: `docs/platform/shell-system.md`
- Block model: `docs/platform/block-model.md`
- Exit architecture: `docs/platform/exit-architecture.md`
- Theme model: `docs/platform/theme-model.md`
- Developer implementation: `docs/platform/developer-implementation.md`
- Migration plan: `docs/platform/migration-plan.md`

## Developer / CI Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

## CLI (Fallback, Not Default Operator Flow)

CLI importer remains for debug/CI/batch operations:
- `pnpm content:onboard`
- `pnpm content:plan`
- `pnpm content:apply`
- `pnpm content:fidelity`
