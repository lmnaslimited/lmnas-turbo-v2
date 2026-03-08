# Block Model

## Block Role

Blocks are reusable content sections.

Blocks are UI-only and never embed business workflow logic.

## Canonical Families

- hero
- logo_wall
- problem_grid
- feature_grid
- testimonial_list
- stats_band
- process_steps
- cta_banner
- faq
- rich_text_section
- comparison_table
- pricing_teaser
- contact_strip
- authority_section
- case_highlight
- timeline
- split_content_media
- form_section
- embedded_asset_section

## Detection Outputs

Each detected block includes:

- visual preview
- proposed family
- confidence
- editable field list
- CTA labels
- linked action IDs
- split/merge intent

## Editable Field Detection

Typical fields:

- heading / subheading / eyebrow
- rich text
- button text / URL
- image / icon
- collection fields (cards, items, stats, FAQ)

Operators can edit detected field sets before publish.

## CTA Rule

Blocks expose CTA placeholders only.

CTA behavior is defined in `ActionBinding`, not in block code.

## Evolution / Versioning

- Keep family names stable
- Introduce new variant behavior via schema evolution
- Preserve backward compatibility in render contracts
- Use mapping overrides during migration when classification changes
