# Codex Scaffold Docs

## What These Docs Are
This folder stores reusable, versioned scaffold documents for `LMNAs Turbo v2`:
- spec document: canonical platform requirements
- prompt document: copy/paste instruction set for Codex runs

Current baseline:
- `Platform Spec v1`
- `Codex Scaffold Spec v1.1`
- `Codex Scaffold Prompt v1.1`
- `Codex Scaffold Prompt v1`

## Files
- `SCaffold_Spec_v1.md`: architecture and constraints source of truth
- `SCaffold_Spec_v1.1.md`: Phase 0 stabilization update for scaffold requirements and guardrails
- `Scaffold_Prompt_v1.1.md`: Phase 0 stabilization scaffold prompt
- `Scaffold_Prompt_v1.md`: deterministic scaffold prompt

## When to Use Spec vs Prompt
Use the spec when:
- reviewing architecture boundaries
- validating completeness
- planning version updates

Use the prompt when:
- running a scaffold or regen task with Codex
- requesting deterministic bootstrap outcomes

## How to Run Codex with the Prompt
1. Open `docs/codex/Scaffold_Prompt_v1.1.md` (or `Scaffold_Prompt_v1.md` for legacy runs).
2. Copy the full prompt content.
3. Run Codex in repo root and paste prompt.
4. Require full boot validation:
   - `pnpm install`
   - `docker compose up -d`
   - `pnpm dev`
   - `pnpm test`
   - `pnpm lint`
   - `pnpm typecheck`

## How to Update Spec/Prompt Safely
1. Update spec first.
2. Reflect same changes in prompt.
3. Keep headings and acceptance checklist in sync.
4. Add version notes under “What changed from previous version”.
5. Re-run validation commands and confirm boot behavior.

## Common Failure Modes
- Docker services start but Strapi page API is not public.
- Next.js boots but falls back to fixture due Strapi API mismatch.
- tests pass partially because test file discovery patterns are wrong.
- boundary lint rules are too weak and allow drift.

## Reporting Errors Back to Codex
When reporting failures, include:
- exact command run
- exact error output
- file path(s) involved
- expected vs actual behavior
- whether issue blocks boot or is a non-blocking warning
