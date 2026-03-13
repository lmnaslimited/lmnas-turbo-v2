# LMNAs Block Catalog

This catalog defines the **approved UI Blocks** for the LMNAs website.
The goal is **reuse-first page building**: most new pages should be assembled by configuring existing blocks in Strapi, not by creating new block types.

**Source reference page:** https://lmnas.com/en :contentReference[oaicite:0]{index=0}

---

## Core rules

### Reuse-first mapping order
When onboarding a URL/HTML into blocks:

1) **Reuse an existing block type** if it can represent the section with configuration + variants.  
2) If the UI differs but the meaning is the same → add a `variant` / `layout` / `theme` field to the existing block.  
3) Only create a new block type if the section cannot be represented cleanly by any existing block.

### Content rules
- Blocks are **pure UI**; no hardcoded marketing copy inside components.
- All block content must come from validated block JSON (Strapi Dynamic Zone).
- Blocks must not fetch data; fetching happens in the page/data layer.

### Governance rules (conversion-sensitive blocks)
These are required for Hero and CTA-style blocks:
- `primaryCta`
- `productMapping`
- `conversionConfig`

Missing required governance fields → **fail fast** (throw; do not render).

---

## Page-level model

A Page entry (Strapi) typically contains:
- slug + locale
- SEO fields (title/description/og image/canonical)
- `blocks[]` (Dynamic Zone) referencing the block types below

Footer/header/newsletter are generally **Global** (single types), not per-page blocks. :contentReference[oaicite:1]{index=1}

---

## Approved blocks

### 1) hero_v1
**Use when:** Above-the-fold hero with headline, subhead, primary/secondary CTA, and media.  
**Reference on /en:** “Reimagine Your Business Through AI Driven ERP” with CTAs and hero image. :contentReference[oaicite:2]{index=2}

**Signature**
- `badge` (optional): `{ icon, text }`
- `headline`: segmented text (supports `gradient` segment)
- `subhead` (optional)
- `primaryCta` (required)
- `secondaryCta` (optional)
- `media.image` (optional)

**Governance (required)**
- `productMapping`, `conversionConfig`, `primaryCta`

**Variants**
- `layout`: `two_col_media_right` (default), `two_col_media_left`, `centered`

---

### 2) problem_statements_v1
**Use when:** A section explains “we solve problems that matter” with multiple Q/A-style problem statements and a CTA.  
**Reference on /en:** “Why Choose LMNAs? We solve problems that matter.” plus problem prompts and “See How We Can Help You”. :contentReference[oaicite:3]{index=3}

**Signature**
- `headline`
- `subhead` (optional)
- `cta` (optional)
- `items[]`: `{ question, answer }`

**Variants**
- `layout`: `stacked`, `two_col_list`

---

### 3) feature_list_v1
**Use when:** A short list of “why trust us” features with title + description.  
**Reference on /en:** “Why Businesses Trust LMNAs” with Tailored Solutions / End-to-End Expertise / Proven Results / Trusted Advisors. :contentReference[oaicite:4]{index=4}

**Signature**
- `headline`
- `subhead` (optional)
- `items[]`: `{ title, description, icon? }`

**Variants**
- `layout`: `grid_2`, `grid_4`

---

### 4) pain_severity_cards_v1
**Use when:** Department cards showing a severity percent + pain statement.  
**Reference on /en:** “Does This Sound Like Your Business?” with Sales/Procurement/Operations/Finance and severity. :contentReference[oaicite:5]{index=5}

**Signature**
- `headline`
- `subhead` (optional)
- `items[]`: `{ department, severityPct, statement }`
- `cta` (optional)

**Variants**
- `layout`: `cards_grid`

---

### 5) solution_cards_v1
**Use when:** A section listing product/solution cards with short descriptions and a CTA.  
**Reference on /en:** “Powerful Solutions Tailored to Your Needs” with LENS ERP Suite, CRM & CPQ, Analytics Cloud, HRMS Cloud, AI-Powered Tools. :contentReference[oaicite:6]{index=6}

**Signature**
- `headline`
- `subhead` (optional)
- `items[]`: `{ title, description, href? , icon? }`
- `cta` (optional)

**Variants**
- `layout`: `grid_3`, `grid_2`, `stacked`

---

### 6) testimonials_v1
**Use when:** Testimonials carousel/list + optional stats + CTA.  
**Reference on /en:** Testimonials + stats (Efficiency Increase, Cost Reduction, Revenue Growth) + “Read Our Case Studies”. :contentReference[oaicite:7]{index=7}

**Signature**
- `headline`
- `subhead` (optional)
- `testimonials[]`: `{ quote, personName, personRole, companyName, companyKey?, avatar? }`
- `stats[]` (optional): `{ label, value }`
- `cta` (optional)

**Variants**
- `layout`: `carousel`, `grid`

---

### 7) cta_dual_v1
**Use when:** Big CTA section with 2 actions (primary/secondary). Often repeated across pages.  
**Reference on /en:**  
- “Transformation begins here…” with “Book a Free Consultation Now” and “Talk to an Expert” :contentReference[oaicite:8]{index=8}  
- “Ready to solve your enterprise challenges?” with “Book Your Free Consultation” and “Contact Us Now” :contentReference[oaicite:9]{index=9}

**Signature**
- `headline`
- `subhead` (optional)
- `primaryCta` (required)
- `secondaryCta` (optional)

**Governance (required)**
- `productMapping`, `conversionConfig`, `primaryCta`

**Variants**
- `theme`: `default`, `accent`, `dark`
- `layout`: `centered`, `split`

---

### 8) journey_steps_v1
**Use when:** A process/journey section with 3–6 steps.  
**Reference on /en:** “Customer Journey” with Discovery Session, Customized Roadmap, Implementation, Continuous Support. :contentReference[oaicite:10]{index=10}

**Signature**
- `headline`
- `subhead` (optional)
- `steps[]`: `{ title, description, icon? }`

**Variants**
- `layout`: `vertical`, `grid`

---

### 9) faq_v1
**Use when:** FAQ accordion/list.  
**Reference on /en:** “Got Questions? We’ve Got Answers!” with multiple questions. :contentReference[oaicite:11]{index=11}

**Signature**
- `headline`
- `items[]`: `{ question, answer? }`
- `cta` (optional)

**Variants**
- `layout`: `accordion`, `list`

---

### 10) promo_link_v1
**Use when:** A “promo” / “trending” section with short copy and a CTA link.  
**Reference on /en:** “Smart Moves. Real Impact.” with “View Trending Now”. :contentReference[oaicite:12]{index=12}

**Signature**
- `headline`
- `subhead` (optional)
- `body` (optional)
- `cta` (optional)

**Variants**
- `layout`: `centered`

---

## When a new block type is allowed

A new block type may be created only if:
- The HTML section cannot be represented by any existing block + variant knobs **without losing structure**; AND
- The section is expected to repeat across pages (not a one-off); AND
- The new block has a clear, stable semantic purpose (not “homepage_section_7”).

If a new block is created, it must ship with:
- Zod schema + TS type
- React component
- Strapi component schema
- Fixture JSON + tests (schema parse + render snapshot/DOM)
- A short “mapping notes” doc: HTML → fields