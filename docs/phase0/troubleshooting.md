# Phase 0 Troubleshooting

### 1. GRAPHQL_VALIDATION_FAILED
Cause:
- Schema drift.
- Generated operations no longer match Strapi schema.

Fix:
- Run `pnpm content:schema`.
- Run `pnpm content:schema:facts` and verify detected fields/types.
- Re-run importer command after regeneration.

### 2. Cannot return null for non-nullable field
Cause:
- Broken CMS content state (required component field missing).

Fix:
- Run `pnpm content:apply --plan <path> --force-update`.
- Ensure `plan.json` contains required components and required fields.

### 3. Slug uniqueness error
Cause:
- A page with the same slug already exists.

Fix:
- Use default upsert mode first.
- Use `--force-create` to create a new entry with auto-suffixed slug.
- Use `--force-update` when repairing an existing page.

### 4. Unknown block type
Cause:
- Block type is not in manifest allowlist (Policy A).

Fix:
- Add/update contract for the block.
- Run contracts sync and regenerate manifest.
- Re-run importer after sync.

### 5. Strapi 401/403
Cause:
- Missing or invalid `STRAPI_TOKEN`.
- Token permissions do not allow the required operation.

Fix:
- Create Strapi API token with required permissions (Full Access for local stabilization).
- Export `STRAPI_TOKEN`.
- Verify with GraphQL ping:
  - `curl -X POST "$STRAPI_URL/graphql" -H "Authorization: Bearer $STRAPI_TOKEN" -H "Content-Type: application/json" -d '{"query":"query Ping { __typename }"}'`

### 6. Preview / publish confusion
Behavior:
- Importer apply defaults writes to `draft`.
- Use `--publish` only when explicit publish is intended.
- Content Manager controls normal publish workflow for team operations.
