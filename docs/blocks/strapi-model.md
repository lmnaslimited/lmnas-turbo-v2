# Strapi Block Configuration Model

This defines how blocks are configured and restricted in Strapi.

The goal:
- Controlled Dynamic Zones
- Allowed block sets per page type
- Conversion governance enforced
- No arbitrary block mixing

---

## 1️⃣ Page Content Type

Strapi Content Type: `Page`

Fields:

- slug (unique)
- locale
- title
- seo (component)
- blocks (Dynamic Zone)

The `blocks` field is a Dynamic Zone composed of approved block components.

---

## 2️⃣ Block Components (Strapi)

Each UI Block in the catalog must have a corresponding Strapi Component.

Example mapping:

hero_v1 → component `blocks.hero-v1`
feature_list_v1 → component `blocks.feature-list-v1`
cta_dual_v1 → component `blocks.cta-dual-v1`

Component structure must mirror Zod schema fields.

Important:
Strapi component fields must stay aligned with the contracts package schemas.

---

## 3️⃣ Block Allowlist per Page Type

Not all pages should allow all blocks.

Define page types:

- marketing_page
- landing_page
- blog_page
- docs_page

Each page type defines an allowed block set.

Example:

### marketing_page allowed blocks
- hero_v1
- problem_statements_v1
- feature_list_v1
- solution_cards_v1
- testimonials_v1
- cta_dual_v1
- faq_v1
- promo_link_v1

### landing_page allowed blocks
- hero_v1
- feature_list_v1
- testimonials_v1
- cta_dual_v1
- faq_v1

### blog_page allowed blocks
- hero_v1 (optional)
- rich_text_block
- cta_dual_v1 (optional)

### docs_page allowed blocks
- rich_text_block
- code_block
- faq_v1

---

## 4️⃣ Conversion Governance Enforcement

In Strapi:

For blocks marked as "conversion-sensitive":

hero_v1
cta_dual_v1

These fields must be required in Strapi:

- primaryCta
- productMapping
- conversionConfig

If Strapi cannot enforce conditional required fields,
validation must happen at render-time in the frontend.

Missing required fields → page fails rendering.

---

## 5️⃣ Reuse vs Create in Strapi

When UX creates a new page:

They must:

1. Select Page Type
2. Only allowed blocks appear in the Dynamic Zone
3. Configure block fields via Strapi form
4. No free-form JSON editing

---

## 6️⃣ Global Blocks (Single Types)

The following should NOT be part of page blocks:

- Header / Navigation
- Footer
- Newsletter Subscribe
- Default SEO

These are Single Types and applied globally.

---

## 7️⃣ Idempotent Import Rule

When Codex imports a page:

- It must match block type names exactly
- It must not create new Strapi components unless approved
- It must reuse existing component schemas
- It must upsert Page by slug

---

## 8️⃣ Integrity Principle

Block integrity is enforced at 3 levels:

1. Strapi Dynamic Zone allowlist
2. Zod schema validation
3. Renderer fail-fast guard

If any layer fails → page must not render.