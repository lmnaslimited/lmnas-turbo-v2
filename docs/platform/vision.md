# LMNAs Website Platform Vision

## Philosophy

LMNAs Website is a governed operating system, not a page dump engine.

Canonical model:
- Shell Layer: navbar/footer/menus/variants
- Block Layer: reusable canonical blocks with structured fields
- Page Assembly Layer: shell + ordered blocks + footer composition
- Exit Layer: governed business actions bound by `exitId`
- Execution Layer: adapter runtime + n8n workflow execution + Rudder events

## Why This Is Not WordPress

- No free-form drag-anything canvas.
- No ungoverned theme overrides per block.
- No ad-hoc CTA logic in templates.
- No bypass of CMS/contract validation.

## Why This Is Not Raw Snapshot Rendering

- Imports are segmented and classified into shell + block + exit assets.
- Editable fields are detected and mapped into Strapi structures.
- Rendering remains structured and governed by contracts.
- Fidelity debt is reported explicitly instead of silently accepted.

## Governance Commitments

- Strapi remains single source of truth.
- Blocks remain pure UI.
- Integrations flow through adapters.
- n8n remains orchestration hub.
- Rudder remains event stream layer.
- Tailwind/theme direction remains platform/page scoped.

## Future-Ready Rationale

This model allows adding new website behaviors by registering new exit contracts/adapters and workflow mappings, without rewriting core shell or block runtime.
