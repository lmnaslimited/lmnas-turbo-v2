# Block Model

## Canonical Families

Supported onboarding families:
- `hero`
- `logo_wall`
- `problem_grid`
- `feature_grid`
- `testimonial_list`
- `stats_band`
- `process_steps`
- `cta_banner`
- `faq`
- `rich_text_section`
- `comparison_table`
- `pricing_teaser`
- `contact_strip`
- `authority_section`
- `case_highlight`
- `timeline`
- `split_content_media`
- `form_section`
- `embedded_asset_section`

## Field Detection

Detected field candidates include:
- heading/subheading/eyebrow
- rich text
- button text/url
- image/icon
- item lists/stats/faq entries

## Mapping Rules

- Importer proposes family + fields with confidence score.
- Operator can override family mapping before publish.
- Final block instances are produced by block-schema mapper.

## Governance

- Blocks are pure UI.
- Conversion blocks require `productMapping`, `primaryCta`, `conversionConfig`.
- Unknown render types fail fast via Policy A.

## Evolution Policy

- Prefer family variants over adding new block types.
- Add a new type only when existing canonical families cannot represent structure.
