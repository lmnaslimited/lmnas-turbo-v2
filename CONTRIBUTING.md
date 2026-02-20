# Contributing

## Required architecture boundaries
- No components in apps (`apps/*/src/components` is disallowed).
- Apps cannot call integrations directly for business logic; keep route logic minimal and delegate to packages.
- Blocks are pure and must not fetch data.
- Put shared schemas only in contracts and block schema files.

## Workflow
- Add tests for renderer/SEO/schema behavior.
- Keep docker compose and `.env.example` in sync.
