# Operator Manual

This guide is for non-technical operators using the Visual Onboarding Studio.

## Studio Model

The studio is split into 4 workflows. They are intentionally separate:

1. Theme Workflow
2. Block Import Workflow
3. Shell Workflow
4. Page Workflow

Open the dashboard at `/platform/onboarding` and choose a workflow card.

## Workflow 1: Theme

Route: `/platform/onboarding/theme`

Use this workflow to:

- browse all theme variants
- inspect token coverage and theme debt
- derive a theme from reference HTML
- set one active theme for production previews/import mapping

When you activate a theme, all production previews in studio use that theme.

## Workflow 2: Block Import

Route: `/platform/onboarding/blocks`

Use this workflow to import reusable blocks only.

Important guardrails:

- no page slug is required here
- this workflow does not create page entities
- publish means block/component publish only

Supported source intake:

- URL
- HTML paste
- file upload
- design handoff inputs already supported by ingestion (`figma_*`, `stitch_*`)

Operational flow:

1. Analyze source.
2. Validate reference preview.
3. Validate production preview + fidelity.
4. Review detected blocks one-by-one.
5. Configure action mapping.
6. Publish selected blocks.

Block Explorer is included in Detection Review:

- search/filter by family, status, theme
- optional filters for recent and in-use
- map detected block to an existing reusable block
- compare detected vs existing block before publish

If a block is skipped, linked actions/widgets are skipped with it.

## Workflow 3: Shell

Route: `/platform/onboarding/shells`

Use this workflow to manage reusable shell variants.

You can:

- browse full/navbar/footer shells
- preview selected shell
- edit menu structure
- edit shell actions/CTAs
- activate shell variants

Activation persists active/inactive state by role.

## Workflow 4: Page

Route: `/platform/onboarding/pages`

Use this workflow to assemble pages from reusable blocks.

You can:

- open grouped block library
- add/remove/reorder blocks
- edit block content fields
- set page-level action overrides (overrides block defaults)
- save draft
- publish/apply

Active shell is pulled from shell workflow state and applied to page preview.
Preview route is returned after save/publish (`/en` or `/en/<slug>`).

## Status + Error Handling

All long-running actions show explicit operator states:

- loading
- disabled controls during request
- success message
- failure message
- retry path without page refresh

Timeouts are surfaced with operator-safe messages (example: Analyze timeout).

## Troubleshooting

- Analyze keeps failing:
  - retry with smaller HTML scope first
  - switch to HTML paste if remote URL is unstable
- Publish says fallback/local save:
  - verify `STRAPI_URL` and `STRAPI_API_TOKEN`
- Theme/shell/page changes not visible:
  - verify the success message completed before navigation
  - reload workflow to confirm persisted state
- Unexpected import quality:
  - use fidelity signals and theme debt report to decide token mapping cleanup
