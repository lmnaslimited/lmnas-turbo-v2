# Phase 0 Importer (GraphQL v1)

This importer is GraphQL-driven for schema discovery, plan generation, and upsert writes.

**Environment variables**
- `STRAPI_URL` (default: `http://localhost:1337`)
- `STRAPI_TOKEN` (required, use a Strapi API token with write permissions)
- `STRAPI_GRAPHQL_PATH` (optional, default: `/graphql`)
- `LMNAS_IMPORTER_STRICT_UPSERT=true` (optional, disables fallback create when update is forbidden)

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

4. Validate plan contract
```bash
pnpm content:validate-plan --plan /tmp/plan.json
```

5. Apply plan using deterministic upsert
```bash
pnpm content:apply --plan /tmp/plan.json
```

6. Force create mode (always create)
```bash
pnpm content:apply --plan /tmp/plan.json --force-create
```

7. Force update mode (must exist)
```bash
pnpm content:apply --plan /tmp/plan.json --force-update
```

## Troubleshooting

- `401/403` during preflight or apply:
  - Create/Use a Strapi API token with write permissions.
  - Ensure token is exported as `STRAPI_TOKEN`.
  - Importer prints endpoint, status, and response body (token is never logged).

- `403` on update operation:
  - Importer logs operation + endpoint + token length + remediation hint.
  - Default behavior falls back to create for Phase 0 testing.
  - Set `LMNAS_IMPORTER_STRICT_UPSERT=true` to disable fallback and fail fast.

- Plan validation errors (`blocks required`, etc.):
  - Run `pnpm content:validate-plan --plan <path>` and fix missing required fields in source content.
