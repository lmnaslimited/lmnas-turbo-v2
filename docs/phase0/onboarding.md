# Phase 0 Importer (v1)

This importer is preview-first and hero-only. It generates a deterministic import plan from a URL or HTML file, then applies the plan into Strapi by upserting a Page.

**Environment variables**
- `STRAPI_URL` (default: `http://localhost:1337`)
- `STRAPI_TOKEN` (required for authenticated Strapi writes)

**Commands**
1. Generate a plan
```
pnpm content:plan -- --url https://lmnas.com/en --slug home --locale en --out /tmp/plan.json
```

2. Apply a plan
```
pnpm content:apply -- --plan /tmp/plan.json
```

**Notes**
- Only `hero` blocks are supported in v1.
- The importer validates blocks using `@lmnas/contracts` and rejects non-allowlisted block types based on the generated manifest.
- For non-home slugs, the importer defaults to `pageType: simple` and `layoutKey: simpleLayout`.
