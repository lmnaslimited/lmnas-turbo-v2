# Migration Plan

## Objective

Move from CLI-first, technical onboarding to visual UI-first governed shell/block/widget/action/exit onboarding.

## Phases

1. Governance and contracts
- Add shell/block/widget/action/exit/onboarding contracts.
- Add Strapi shell/widget/action/exit schema scaffolding.

2. Runtime scaffolding
- Add detector/mapper/runtime modules for shell/block/widget/action/exit.
- Add shell-aware layout scaffolding.
- Add action + exit runtime skeleton.

3. Operator rollout
- Launch visual onboarding wizard in site app.
- Keep CLI as debug/CI fallback.

4. Apply hardening
- Connect `apply` mode to full Strapi sync write path.
- Add environment-specific permissions and audit logs.

## Deprecated-by-Default Flows

- `pnpm content:onboard` as primary operator flow.
- CLI-only onboarding for day-to-day content operations.
- CTA behavior changes through block code edits.
- Raw JSON dry-run as default operator output.
- First-step exposure of technical IDs (`shellVariantId`, `navbarVariantId`, `footerVariantId`) in normal flow.

CLI remains supported for:
- CI checks
- bulk/debug imports
- developer diagnostics

## Compatibility

- Existing routes and page rendering remain operational.
- Existing hero payloads are normalized through integration mapping fallback.

## Rollout Checks

- Validate section import happy path in onboarding UI.
- Validate full-page shell+block+widget+action+exit proposals.
- Validate operator summary view and warnings.
- Validate apply mode behavior with/without Strapi env vars.
