# UI-Led Onboarding Workflow

## Flow

1. Source Intake
- Operator inputs source type + payload + slug/locale/theme.

2. Analysis
- System runs shell detector, block detector, field detector, exit detector, theme notes, fidelity warnings.

3. Confirmation
- Operator confirms or overrides:
  - shell variant IDs
  - block families
  - exit states

4. Publish-to-Strapi
- System builds canonical sync payload:
  - shell variants/menus
  - block instances
  - exit definitions/bindings
  - page assembly model

5. Result
- System returns summary counts + warnings + generated payload.

## Operator Responsibilities

- Provide source and base metadata.
- Validate detection output.
- Apply override decisions.
- Review warnings before publish.

## Developer Responsibilities

- Maintain contracts and adapter registry.
- Maintain detector heuristics and mapper logic.
- Maintain Strapi schemas and sync implementation.
- Maintain exit adapter runtime integration.

## Happy Path

- Input valid source -> analysis success -> confirm mappings -> dry run summary clean -> apply succeeds.
