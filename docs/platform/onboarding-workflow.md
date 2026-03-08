# Onboarding Workflow

## UX Goal

The operator should always understand:

- what was detected
- how it looks
- what will be imported
- what fields become editable
- what each CTA will do
- what Strapi objects will be created

## Step-by-Step Wizard

1. Source Intake
- Input source type (`url`, `raw_html`, `figma_*`, `stitch_*`)
- Paste source or upload handoff file
- Enter slug and locale

2. Source Preview
- View interpreted source in preview panel
- Verify source quality before mapping

3. Detection Review
- Cards show shells, blocks, widgets, and actions
- Each card includes preview, confidence, fields, CTA summary
- Operator chooses Import or Skip for each item

4. Selection & Mapping
- Override block family when needed
- Edit detected editable fields
- Map to existing shell/block/widget models when reuse is preferred
- Set split/merge intent for sections where needed

5. Action Mapping
- For each CTA, choose action:
  - Link URL
  - Scroll to section
  - Open modal/drawer/widget
  - Submit form
  - Download asset
  - External booking
  - Backend workflow
- Advanced exit details stay hidden unless workflow-backed action is selected

6. Publish Summary
- Default dry run = **Preview What Will Be Created**
- Summary shows counts for shells/blocks/widgets/actions/exits/fields
- Warnings shown in plain language
- Developer JSON available only in collapsed details panel

## Operator Responsibilities

- Review and curate detected items
- Confirm CTA behavior
- Validate warnings before apply

## Developer Responsibilities

- Maintain schema contracts and detectors
- Maintain adapter runtime and exit contracts
- Maintain Strapi schema compatibility
- Improve detection precision over time

## Happy Path

1. Analyze succeeds
2. Operator keeps needed cards, skips noise
3. Action mappings are clear
4. Preview summary has acceptable warnings
5. Apply succeeds and entries are available in Strapi
