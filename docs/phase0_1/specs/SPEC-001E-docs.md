# SPEC-001E - docs

## Linked Intake: INT-001

## Scope

- Documentation updates:
  - README
  - AGENTS
  - Import system docs

## Non-goals

- No runtime feature implementation in this RR artifact set.

## Documentation requirements (deterministic)

- Document that snapshot fallback renders from sanitized JSON (`domJson`) and never from raw HTML.
- Document that safelist generation is deterministic (byte-identical output given identical inputs).
- Document scoped stylesheet wrapper behavior: strict `#imported-<hash>` wrapper and `@layer components`.
- Document diff gate threshold: `diffRatio <= 0.005` required unless forced.
- Document confidence scoring formula and strict threshold: `confidence >= 0.85`.
- Document theme token registry + ThemeDebtReport schema and thresholds.

## Files to Create/Modify

| Path | Change Type | Reason |
| --- | --- | --- |
| docs/phase0/README.md | modify | Import fidelity pipeline overview |
| docs/phase0/onboarding.md | modify | Include snapshot fallback, determinism, and theme usage |
| docs/phase0/troubleshooting.md | modify | Add fidelity runner and diff gate troubleshooting |
| AGENTS.md | modify | Ensure Phase 0.1 governance references are current |

## Test Plan (unit/integration/e2e)

- N/A (documentation-only task group)

## Rollout / Risk notes

- Docs must remain aligned with Policy A allowlisting and Phase 0 constraints.

