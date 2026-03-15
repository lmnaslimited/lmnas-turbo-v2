# Page Workflow

Route: `/platform/onboarding/pages`

## Purpose

Assemble publishable pages from reusable studio blocks and active shell state, then persist page structure and overrides.

## Operator Flow

1. Load grouped block library.
2. Add blocks to page canvas.
3. Reorder/remove blocks.
4. Edit block content fields.
5. Configure page-level action overrides.
6. Set slug/locale.
7. Save draft or publish/apply.

## Behavior Guarantees

- page preview includes active shell context
- preview does not render debug block names as UI labels
- page-level action overrides replace block defaults for that page
- save and publish actions are timeout-safe and operator-visible

## Persistence APIs

- `GET /api/platform/studio/pages`
- `POST /api/platform/studio/pages`

Payload includes:

- `blockOrder`
- `fieldValues`
- `actionOverrides`
- `activeShellId`
- `slug`, `locale`

`POST` modes:

- `mode: "save"` persists draft metadata/state
- `mode: "apply"` attempts content-importer apply to Strapi and returns warnings if unavailable

## Preview Route

API response returns `previewRoute`:

- home slug: `/<locale>` (example: `/en`)
- non-home slug: `/<locale>/<slug>`

Local verification is covered in e2e by requesting `/en/<slug>` after publish and asserting no server crash status.
