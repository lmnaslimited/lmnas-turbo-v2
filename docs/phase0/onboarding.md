# Phase 0 Importer (GraphQL v1)

This importer is GraphQL-driven for schema discovery, plan generation, and upsert writes.
Policy A allowlist is enforced at runtime; block types must exist in both manifest and registry (see `docs/blocks/contracts-sync.md`).

## Prerequisites

- Node 22 LTS
- `STRAPI_URL` (default: `http://localhost:1337`)
- `STRAPI_TOKEN` (required, use a Strapi API token with write permissions)
- `STRAPI_GRAPHQL_PATH` (optional, default: `/graphql`)

## One-Command Onboarding

Dry run (plan only):
```bash
pnpm content:onboard --url https://lmnas.com/en --slug home --locale en
```

Apply:
```bash
pnpm content:onboard --url https://lmnas.com/en --slug home --locale en --apply
```

HTML mode:
```bash
pnpm content:onboard --html /tmp/lmnas-home.html --slug home --locale en --apply
```

Custom output:
```bash
pnpm content:onboard --url https://lmnas.com/en --slug home --locale en --out docs/import-plans/home.en.json
```

Default output path when `--out` is omitted:
`docs/import-plans/<slug>.<locale>.json`

## Token Quick Check

```bash
curl -X POST "${STRAPI_URL}/graphql" \
  -H "Authorization: Bearer ${STRAPI_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "query": "query Ping { __typename }" }'
```

## Commands

1. Introspect schema and regenerate dynamic-zone fragments + operation types
```bash
pnpm content:schema
```

2. Print schema facts detected from introspection (query args, page identifiers, i18n types, blocks union)
```bash
pnpm content:schema:facts
```

3. Generate a plan from Strapi page content
```bash
pnpm content:plan --url https://lmnas.com/en --slug home --locale en --out /tmp/plan.json
```

Auto mode note:
- Plan generation uses import mode `auto` by default (strict attempt + snapshot fallback per section by confidence score).
- To enable a theme in plan metadata, pass `--theme <themeKey>`.

Example with theme:
```bash
pnpm content:plan --url https://lmnas.com/en --slug home --locale en --theme brand-light --out /tmp/plan.json
```

4. Validate plan contract
```bash
pnpm content:validate-plan --plan /tmp/plan.json
```

5. Apply plan using deterministic upsert
```bash
pnpm content:apply --plan /tmp/plan.json
```
Default apply write state is `draft`.

If you need to publish from importer explicitly:
```bash
pnpm content:apply --plan /tmp/plan.json --publish
```

6. Force create mode (always create, auto-suffixes slug if base slug already exists)
```bash
pnpm content:apply --plan /tmp/plan.json --force-create
```

7. Force update mode (must exist)
```bash
pnpm content:apply --plan /tmp/plan.json --force-update
```

8. Force replace mode (delete existing by slug, then recreate)
```bash
pnpm content:apply --plan /tmp/plan.json --force-replace
```

9. Run fidelity gate before apply (required for snapshot plans)
```bash
pnpm content:fidelity --plan /tmp/plan.json --baseline-url https://lmnas.com/en --candidate-url http://localhost:3000/en
```

10. Run fidelity across additional themes
```bash
pnpm content:fidelity --plan /tmp/plan.json --baseline-url https://lmnas.com/en --candidate-url http://localhost:3000/en --themes dark,light
```

11. Force apply override when fidelity gate fails (controlled bypass)
```bash
pnpm content:apply --plan /tmp/plan.json --force
```

## Playwright Setup for Fidelity Capture

Install package:
```bash
pnpm add -D playwright
```

Install browser:
```bash
pnpm exec playwright install chromium
```

Capture artifacts produced by `content:fidelity`:
- `fidelity-report-<slug>.json`
- `fidelity-<theme>.png`
- `baseline-<theme>.png`
- `fidelity-<theme>.diff.json`

If Playwright is not installed, `content:fidelity` exits with an explicit setup error and does not mutate apply state.

## Troubleshooting

- `401/403` during preflight or apply:
  - Create/Use a Strapi API token with write permissions.
  - Ensure token is exported as `STRAPI_TOKEN`.
  - Importer prints endpoint, status, and response body (token is never logged).

- Slug uniqueness during `--force-create`:
  - Importer auto-generates `${slug}--import-YYYYMMDD-HHmmssSSS` and logs the final slug.

- Plan validation errors (`blocks required`, etc.):
  - Run `pnpm content:validate-plan --plan <path>` and fix missing required fields in source content.
