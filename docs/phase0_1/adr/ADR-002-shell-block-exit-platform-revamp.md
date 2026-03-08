# ADR-002 - Shell/Block/Exit Platform Revamp

## Status

Accepted

## Context

The current onboarding flow is CLI-heavy and page-snapshot oriented. It does not provide a simple operator experience for extracting reusable shells, canonical blocks, and governed exits from imported sources. This increases developer dependency and creates drift risk against Constitution v2.1 mandates.

## Decision

Adopt a governed five-layer model for website operations:

1. Shell Layer
2. Block Layer
3. Page Assembly Layer
4. Exit Layer
5. Execution Layer

Implementation decisions:

- UI-first onboarding becomes default operator path in `apps/site`.
- CLI importer remains for CI/debug/batch, not the primary operator flow.
- Shells (navbar/footer) are modeled as first-class structures, not ordinary blocks.
- Exits are modeled as contracts with adapter runtime indirection; blocks bind by `exitId`.
- Onboarding pipeline is modularized into detector/mapper/runtime modules under `@lmnas/integrations`.
- Strapi model scaffolding is expanded for shell/exit structures and page references.

## Consequences

Positive:
- Lower operator friction and reduced junior developer dependency.
- Stronger governance boundaries for shell/block/exit separation.
- Extensible adapter path for future requirement-to-code/BPMN-heavy exits.

Tradeoffs:
- More contracts and modules to maintain.
- Existing hero/page data shape requires compatibility handling during migration.
- Strapi runtime migration scripts remain a follow-up to full production cutover.

## Linked Intake/Spec

- `INT-002-shell-block-exit-platform-revamp`
- `SPEC-002-shell-block-exit-platform-revamp`
