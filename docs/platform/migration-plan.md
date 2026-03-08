# Migration Plan

## Objective

Move from CLI-first page onboarding to UI-first governed shell/block/exit onboarding.

## Phases

1. Governance and contracts
- Add shell/exit/onboarding contracts.
- Add Strapi shell/exit schema scaffolding.

2. Runtime scaffolding
- Add detector/mapper/runtime modules.
- Add shell-aware layout scaffolding.
- Add exit runtime skeleton.

3. Operator rollout
- Launch onboarding console in site app.
- Keep CLI as debug/CI fallback.

4. Apply hardening
- Connect `apply` mode to full Strapi sync write path.
- Add environment-specific permissions and audit logs.

## Deprecated-by-Default Flows

- `pnpm content:onboard` as primary operator flow.
- CLI-only onboarding for day-to-day content operations.
- CTA behavior changes through block code edits.

CLI remains supported for:
- CI checks
- bulk/debug imports
- developer diagnostics

## Compatibility

- Existing routes and page rendering remain operational.
- Existing hero payloads are normalized through integration mapping fallback.

## Rollout Checks

- Validate section import happy path in onboarding UI.
- Validate full-page shell+block+exit proposals.
- Validate dry-run payload and warnings.
- Validate apply mode behavior with/without Strapi env vars.
