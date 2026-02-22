# Block Contract Source of Truth

`packages/contracts` is the source of truth for block contracts.

## What is generated

`pnpm contracts:gen` generates:

- Strapi component schemas from contract metadata and Zod schema
  - Example: `services/strapi/src/components/blocks/hero.json`
- Block manifest consumed by registry/runtime
  - `packages/block-registry/src/generated/blocks.manifest.ts`

## Workflow

1. Edit or add a contract in `packages/contracts/src/blocks/*.contract.ts`.
2. Run `pnpm contracts:gen`.
3. Commit both the contract and generated files.

## Drift prevention

`pnpm contracts:check` regenerates outputs in a temp directory and compares with committed files.

- If drift is found, it fails and prints: `Run pnpm contracts:gen`.
- This check is wired into test execution through `@lmnas/contracts-sync`.

## Adding the next block contract

1. Create `packages/contracts/src/blocks/<block>.contract.ts` with:
   - `type`
   - `meta.strapi` (`schemaPath`, `collectionName`, `displayName`)
   - `meta.governance`
   - `meta.editor.allowedOnPageTypes`
   - `schema`
2. Export it via `packages/contracts/src/blocks/index.ts` and `packages/contracts/src/index.ts`.
3. Run `pnpm contracts:gen`.
4. Ensure `pnpm contracts:check` passes.
