# Operator Manual

This guide is for content managers and marketing operators.

## What You Manage

- Shells: navbar, footer, utility bar, announcement bar
- Blocks: reusable page sections
- Widgets: modal, drawer, booking popup, download gate, chat launcher
- Actions: what a CTA click does
- Exits: backend/business workflow contracts

## Daily Workflow

1. Open `/platform/onboarding`.
2. Paste source (URL, HTML, Figma handoff, or Stitch artifact).
3. Review **Source Preview** (desktop/tablet/mobile + zoom).
4. Review **Detection Cards** (visual thumbnails, confidence, fields, CTA/action summary).
5. Import what you want and skip the rest.
6. Click cards to highlight the matching source region.
7. Confirm block/widget fields and CTA action behavior.
8. Run **Preview What Will Be Created**.
9. Review the assembled visual preview.
10. If summary looks good, click **Publish to Strapi**.

## Scenario A: Import One Section

1. Choose `Raw HTML` or `URL`.
2. Paste section source.
3. Confirm detected block card.
4. Keep only the needed block.
5. Set CTA action (for example: Open widget -> booking popup).
6. Preview creation summary.
7. Publish.

Result: section appears in Strapi page assembly and fields are editable.

## Scenario B: Import Full Page

1. Choose full-page source.
2. Review detected shells (navbar/footer/utility/announcement).
3. Review detected blocks and widgets visually.
4. Use Import/Skip per card and keep only required sections.
5. Confirm CTA actions for each important button/link.
6. Use action trace cards to verify parent block + CTA text.
7. Preview creation summary and warnings.
8. Preview the assembled page.
9. Publish.

Result: shell + block + widget + action objects are created in governed form.

## Scenario C: Change CTA Behavior Without Code Changes

1. Open onboarding or Strapi action mapping.
2. Find CTA action binding.
3. Change behavior:
   - URL -> widget
   - widget -> workflow
   - workflow target -> different exit
4. Save/publish.

Result: behavior changes without editing block component code.

## Menu / Submenu Management

- Manage menu items in shell navigation models.
- Add submenu items under navigation groups/items.
- Preview shell updates before publishing.

## Warnings (Plain Language)

- “Low confidence block/widget”: confirm mapping before publish.
- “Workflow review required”: check action-to-exit mapping.
- “Navbar/footer missing”: choose fallback shell mapping.
- “Theme debt”: imported styles use arbitrary values; tokenize later.
- “Widget mapping gap”: a CTA expects a widget that is not selected/imported.
- “Exit mapping gap”: a workflow action required an auto-generated exit contract; review mapping.

## Troubleshooting

- Nothing detected:
  - Re-run with cleaner source HTML.
  - Check if source has valid semantic tags.
- Wrong section type:
  - Override block family in Selection & Mapping.
- CTA not doing the right thing:
  - Re-open Action Mapping and update action type.
- Publish cannot apply:
  - `STRAPI_URL` and `STRAPI_API_TOKEN` are not configured.
- Need developer payload details:
  - Open the **Developer details** section in Publish Summary (collapsed by default).
