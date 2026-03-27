# Phase 0 Definition of Done

## Contracts
- [ ] `pnpm contracts:check` passes.
- [ ] No schema mismatch warnings in importer/contract sync flow.
- [ ] Generated artifacts align with current Strapi introspection.

## Manifest
- [ ] Policy A allowlist is enforced.
- [ ] Unknown block types are rejected safely.
- [ ] Renderer does not crash on unknown blocks.

## Importer
- [ ] `pnpm content:schema` works.
- [ ] `pnpm content:plan` works.
- [ ] `pnpm content:apply` works with deterministic upsert behavior.
- [ ] Safe-read logic handles broken CMS content.
- [ ] Slug uniqueness is handled deterministically.
- [ ] `--force-update` repairs invalid CMS entries.

## Onboarding
- [ ] Home hero can be onboarded through importer.
- [ ] `plan.json` is treated as authoritative desired state.
- [ ] Apply repairs CMS state when drift is detected.

## Tests
- [ ] `pnpm test` passes.
- [ ] Onboard tests cover default dry-run.
- [ ] Onboard tests cover apply mode.
- [ ] Onboard tests cover flag validation.
- [ ] Apply tests cover slug uniqueness handling.
- [ ] Apply tests cover repair-safe flow.

## Stability Criteria
- [ ] No `GRAPHQL_VALIDATION_FAILED` during normal usage.
- [ ] No silent failures in importer flow.
- [ ] No token leakage in logs.
- [ ] No runtime renderer crash for hero baseline.
