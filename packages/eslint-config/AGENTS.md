# eslint-config — Codex Orientation

## Scope
This package defines LMNAs shared ESLint configuration(s) used across apps, packages, and services. The goal is consistent, enforceable code hygiene with minimal disruption.

## Rules
- Treat this package as **governance**: changes here affect the entire monorepo.
- Prefer **incremental** tightening over big-bang rule additions.
- Avoid rules that cause mass reformatting unless coordinated with Prettier/format tooling.
- Keep configs **composable** (base → framework-specific → app overrides).
- Any new rule must be:
  - justified (why),
  - documented (what it enforces),
  - and validated across representative workspaces.
- Do not disable rules in consumer repos unless there is a documented exception.
- Align TypeScript linting with the repo TS config(s); do not invent incompatible parserOptions.
- Keep dependency footprint small; avoid adding plugins unless clearly necessary.

## Do
- Add/adjust rules with clear intent: correctness > safety > maintainability > style.
- Provide `overrides` per file type (e.g., `*.test.*`, `*.config.*`, `*.d.ts`) rather than blanket disables.
- Verify changes by running lint in at least:
  - one app (e.g., `apps/site`)
  - one package (e.g., `packages/blocks`)
  - one service (e.g., `services/strapi`)
- Document rule changes in a short CHANGELOG section in the PR description.

## Don’t
- Don’t introduce breaking changes without a coordinated cleanup PR.
- Don’t add opinionated style rules that conflict with formatting tools.
- Don’t “fix” lint by adding broad `eslint-disable` comments in consumers.

## Change Checklist (for any PR touching this package)
- [ ] Explain the rationale for each rule added/changed/removed
- [ ] Confirm which workspaces were linted successfully
- [ ] Confirm no new warnings/errors across the monorepo
- [ ] Provide migration notes if any consumer code must change

## Notes
- This package should remain framework-aware (Next.js/React/Node) via layered configs, not a single monolith.
- If a rule creates excessive false positives, prefer refining options/overrides before removing it.