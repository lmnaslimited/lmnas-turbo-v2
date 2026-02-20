# Contributing

## Platform Rules

- No components in apps.
- Apps cannot call integrations directly.
- Blocks are pure.

## Required Development Flow

1. Keep reusable UI in `packages/blocks` or `packages/renderer`, never in `apps/*/src/components`.
2. Keep data contracts in `packages/contracts` and block schemas in `packages/blocks/*/schema.ts`.
3. Keep integration adapters in `packages/integrations` transport-only and schema-validated.
4. Add/update tests with every behavior change (`pnpm test`).
5. Run lint before commit (`pnpm lint`).
