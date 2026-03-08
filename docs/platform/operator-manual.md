# Operator Manual

## 1. Import A Section

1. Open `/platform/onboarding` in the site app.
2. Select source type (`url`, `raw_html`, `figma_*`, `stitch_*`).
3. Paste source payload and set slug/locale/theme.
4. Click **Analyze Source**.
5. Confirm block family mapping and exit state mapping.
6. Run **Publish Dry Run** to preview generated payload.

## 2. Import A Full Page

1. Use full-page source type (`figma_full_page`, `stitch_full_page`, or full HTML/URL).
2. Analyze source.
3. Confirm shell detection (`navbar`, `footer`, announcement bars).
4. Confirm block ordering and family mapping.
5. Confirm exit definitions/bindings.
6. Publish dry run first, then apply when configuration is ready.

## 3. Choose Navbar/Footer

- Use confirmation fields for `shellVariantId`, `navbarVariantId`, `footerVariantId`.
- Keep naming stable per page group for reuse.

## 4. Assemble Page

- Page assembly is generated as: shell assignment + ordered block IDs + footer/nav variants.
- Review `strapiPayload.pageAssembly` in publish output.

## 5. Edit Content

- Edit content in Strapi components for shell menus, block fields, and page entries.
- Do not edit block code for normal copy changes.

## 6. Manage Menu/Submenu

- Maintain menu items inside shell navigation models.
- Use submenu items for nested navigation.

## 7. Manage Exits

- Update exit state (`active`/`inactive`) in onboarding confirmation or Strapi exit definitions.
- Re-route workflow targets via exit definition config.

## 8. Preview

- Use dry run output for payload review.
- Validate shell/block/exit warnings before apply.

## 9. Publish

- `dry-run`: generates payload only.
- `apply`: attempts Strapi apply when environment tokens are configured.

## Troubleshooting

- Missing shell candidates: assign fallback shell variant IDs and continue.
- Low-confidence block mapping: override family manually before publish.
- Apply unavailable warning: set `STRAPI_URL` and `STRAPI_API_TOKEN`, then rerun.
