---

## Block signature cheatsheet

Use this as the **default matching logic** when onboarding a URL/HTML into Strapi blocks.

### Quick matching rules (by section structure)

**A) Hero**
- **If**: above-the-fold, 2-column layout, headline + subhead + 1–2 CTAs + image/media  
- **Use**: `hero_v1`

**B) Problems / objections / “we solve…”**
- **If**: heading like “Why choose…” + list of question/statement items with short explanations  
- **Use**: `problem_statements_v1`

**C) “Why trust us” feature bullets**
- **If**: heading + 3–6 feature tiles each with title + description (icons optional)  
- **Use**: `feature_list_v1`

**D) Department pain with severity/percent**
- **If**: cards with department name + numeric severity + one-liner pain  
- **Use**: `pain_severity_cards_v1`

**E) Product/Solution cards**
- **If**: a grid of solutions/products (title + description + optional link) + CTA  
- **Use**: `solution_cards_v1`

**F) Testimonials**
- **If**: quotes attributed to people/companies (carousel or grid), often with “case studies” CTA  
- **Use**: `testimonials_v1`

**G) Strong CTA section with 2 actions**
- **If**: big statement + 2 buttons/links (primary + secondary)  
- **Use**: `cta_dual_v1`

**H) Journey / steps**
- **If**: numbered steps (3–6), each with title + short description  
- **Use**: `journey_steps_v1`

**I) FAQ**
- **If**: list of questions (answers may be hidden/accordion)  
- **Use**: `faq_v1`

**J) Promo / trending**
- **If**: short promo copy + single CTA link/button (often “View…” / “Learn more…”)  
- **Use**: `promo_link_v1`

---

## Variant policy

Variants exist to prevent block-type explosion.

### When to add a variant (preferred)
Add a `variant`, `layout`, `theme`, `density`, or `alignment` field to an existing block when:
- The **semantic meaning** is the same (hero is still hero; CTA is still CTA)
- Only the **visual layout** changes (left vs right media, centered vs split)
- The section repeats across multiple pages in different styles
- You can keep the same Strapi component shape (or extend it without breaking old data)

**Examples**
- Same hero content, new layout → `hero_v1.layout = "centered"`
- Same CTA block, different background/contrast → `cta_dual_v1.theme = "dark"`

### When NOT to add a variant (create a new block type)
Create a new block type only when:
- The section has a **different semantic purpose** (not just different styling)
- The data model changes fundamentally (e.g., needs nested objects, tables, filters)
- Forcing it into an existing block would create “optional field soup”
- The section is expected to be reused in multiple places

**Anti-pattern warning**
Do not create blocks like:
- `home_section_7`
- `hero_home_v2`
- `solutions_grid_home`

Block types must describe **semantic intent**, not page placement.

---

## Decision tree for onboarding (Codex must follow)

For each HTML section:

1) Identify signature → choose block type from cheatsheet.  
2) Check if existing block supports it as-is.  
3) If styling differs:
   - add `variant/layout/theme` to the chosen block  
   - do NOT create a new block type  
4) Only create a new block type if:
   - no existing block matches semantically, AND
   - the new type will repeat, AND
   - the schema remains clean and stable.

---

## Conversion governance reminder

For conversion-sensitive blocks (`hero_v1`, `cta_dual_v1`, landing CTAs):
- `primaryCta` is required
- `productMapping` is required
- `conversionConfig` is required

Missing any of these must fail fast (throw, do not render).

---

## Recommended “minimum page kit”

To build most LMNAs marketing pages without new blocks, aim to assemble pages from:
- `hero_v1`
- `problem_statements_v1`
- `feature_list_v1`
- `solution_cards_v1`
- `testimonials_v1`
- `cta_dual_v1`
- `faq_v1`

If a new page cannot be modeled with these + variants, document why before creating new block types.