# Shell Workflow

## Objective

Manage reusable shell variants (full, navbar, footer) as first-class platform objects with persisted activation state and editable CTA/menu behavior.

Route: `/platform/onboarding/shells`

## Capabilities

- browse active/inactive shells grouped by role
- preview selected shell
- inspect and edit menu structure
- inspect and edit shell actions/CTAs
- add/update/delete shell actions
- activate a shell variant

## Persistence

Primary APIs:

- `GET /api/platform/studio/shells`
- `POST /api/platform/studio/shells`
- `POST /api/platform/studio/shells/activate`

Strapi path (when configured):

- reads/writes `shell-variants` collection
- preserves shell role and action payloads
- updates active/inactive status on activation

Fallback path (when Strapi unavailable):

- reads/writes local studio store
- maintains role-based active state
- returns explicit source markers (`strapi` vs `fallback`)

## Data Model (UI-facing)

- shell identity: `id`, `key`, `name`, `role`, `status`
- preview: `previewHtml`
- menu: hierarchical menu items
- actions: `{ id, label, type, target }`

## Operator Guarantees

- no static/demo-only browsing path
- action edits persist through save cycle
- activation is explicit and persisted
- loading/error states are shown for load/save/activate actions
