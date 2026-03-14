# Onboarding Workflow

## Purpose

The Visual Onboarding Studio is a UI-first operator flow for onboarding themes, blocks, shells, and pages without collapsing these into one monolithic import path.

## Workflow Topology

1. Theme Workflow (`/platform/onboarding/theme`)
2. Block Import Workflow (`/platform/onboarding/blocks`)
3. Shell Workflow (`/platform/onboarding/shells`)
4. Page Workflow (`/platform/onboarding/pages`)

Each workflow has its own persistence path and can be executed independently.

## Data Contracts

- Theme, block, shell, and page models are schema-first contracts in `@lmnas/contracts`.
- Block Import publishes reusable block templates and action metadata.
- Page Workflow composes instances and page-level overrides from reusable objects.
- CTA behavior remains adapter-routed; no business logic inside blocks/shells.

## Runtime Paths

Primary APIs:

- `POST /api/platform/onboarding/analyze`
- `POST /api/platform/studio/blocks/publish`
- `GET/POST /api/platform/studio/themes`
- `POST /api/platform/studio/themes/activate`
- `GET/POST /api/platform/studio/shells`
- `POST /api/platform/studio/shells/activate`
- `GET/POST /api/platform/studio/blocks`
- `GET/POST /api/platform/studio/pages`

Fallback behavior:

- If Strapi is configured and reachable, studio routes read/write Strapi content types.
- If Strapi is unavailable, routes continue in local fallback store with explicit operator messaging.

## Block Import Execution

Operational steps:

1. Source intake (`url`, `raw_html`, file upload, `figma_*`, `stitch_*`)
2. Reference preview
3. Production preview + fidelity report
4. Detection review (block-by-block)
5. Action mapping
6. Publish blocks

Required behavior implemented:

- no page slug in block import
- no page entity creation in block import
- map-to-existing block support
- Block Explorer for reusable block browse/filter/compare
- timeout-safe analyze/publish requests with retry-safe UI states

## Shell Execution

- browse active/inactive shells by role
- edit menu/actions
- activate selected shell and persist active state

## Page Execution

- grouped block library + content editing
- page-level action overrides
- save and publish/apply
- preview route returned from API (`/en` or `/en/<slug>`)

## State Safety Rules

All async actions must expose:

- loading state
- disabled controls while in-flight
- success/failure messaging
- timeout handling
- retry without deadlock

Shared timeout-safe client request helper is used by studio pages.

## Regression Coverage

Playwright suite `apps/site/e2e/studio-workflows.spec.ts` covers:

- theme load/browse/activate
- block analyze + map-to-existing + publish
- analyze timeout/hang regression
- shell browse/edit/activate
- page assemble/edit/override/save/publish

Visual baseline `apps/site/e2e/onboarding.visual.spec.ts` covers core visual states for block import preview/review/publish.
