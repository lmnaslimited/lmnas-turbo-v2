# Phase 0 - Platform Stabilization

## 1. Objective
- Stabilize content importer (v1 hero onboarding baseline).
- Enforce contract-driven workflow.
- Ensure Strapi v5 GraphQL alignment.
- Ensure renderer safety and manifest enforcement.
- Prepare for team testing.

Phase 0 is stabilization only.
Phase 0 is not feature expansion.

## 2. Architecture Layers (Authoritative Order)

### Contracts
- Responsibility: define content contracts and validation rules (Zod + TS types).
- Input: contract source files in `packages/contracts`.
- Output: typed schemas used by importer and runtime validation.
- Failure modes: invalid payload shape, missing required fields, contract drift.
- Owner: Dev.

### Contracts Sync
- Responsibility: generate and verify synced artifacts from contracts.
- Input: contract definitions.
- Output: generated contract artifacts and drift-check status.
- Failure modes: contract drift, generation mismatch, failed `contracts:check`.
- Owner: Dev/System.

### Strapi CMS
- Responsibility: content storage, content model enforcement, GraphQL endpoint.
- Input: validated writes from importer/content manager.
- Output: page data and schema introspection results.
- Failure modes: auth failures (401/403), validation errors, broken partial records.
- Owner: Content/System.

### Importer (Plan/Apply)
- Responsibility: create plan JSON, validate plan, apply deterministic upsert.
- Input: URL/HTML/Strapi data + contracts + schema facts.
- Output: `plan.json` and upsert result (`documentId`, `slug`, `status`).
- Failure modes: schema mismatch, invalid plan, slug conflicts, GraphQL operation errors.
- Owner: Dev/System.

### Manifest
- Responsibility: enforce Policy A allowlist for renderable block types.
- Input: generated block manifest from contracts sync.
- Output: allowlisted block type set used by importer/renderer.
- Failure modes: unknown block rejection, missing contract-to-manifest sync.
- Owner: Dev/System.

### Renderer
- Responsibility: safe runtime rendering of allowlisted blocks.
- Input: validated page payload + manifest + block registry.
- Output: rendered UI.
- Failure modes: unknown block type rejection, schema validation failure.
- Owner: System.

## 3. Local Setup

```bash
# Node 22 required
nvm install 22
nvm use 22

# environment
export STRAPI_URL=http://localhost:1337
export STRAPI_TOKEN=<your_strapi_api_token>

# install
pnpm install

# refresh schema artifacts
pnpm content:schema

# generate plan
pnpm content:plan --url https://lmnas.com/en --slug home --locale en --out /tmp/plan.json

# one-command onboarding (default dry-run)
pnpm content:onboard --url https://lmnas.com/en --slug home --locale en

# run test suite
pnpm test
```

## 4. Onboarding Workflow (Hero Baseline)
- `content:onboard` defaults to dry-run (plan only).
- `content:onboard --apply` runs plan generation + apply.
- Default plan path: `docs/import-plans/<slug>.<locale>.json`.
- Custom plan path: pass `--out <path>`.

## 5. Import Mode `auto` (Default)

Import mode auto is always enabled for HTML/URL plan generation.
No extra mode flag is required.

```bash
# URL input (auto mode)
pnpm content:plan --url https://lmnas.com/en --slug home --locale en --out /tmp/plan.json

# HTML input (auto mode + theme key in plan metadata)
pnpm content:plan --html /tmp/lmnas-home.html --slug home --locale en --theme brand-light --out /tmp/plan.json
```

Plan outputs include deterministic source metadata:
- `source.importMode` (per-section `strict|snapshot`, confidence, metrics)
- `source.fidelity` (pending threshold/report path metadata)
- `source.theme` (when `--theme` is set; default theme is `default`)

## 6. Fidelity Gate (Before Apply)

Run fidelity capture and diff gate before apply:

```bash
pnpm content:fidelity \
  --plan /tmp/plan.json \
  --baseline-url https://lmnas.com/en \
  --candidate-url http://localhost:3000/en
```

Theme fidelity runs:
- Set plan theme at plan time using `--theme <themeKey>`.
- Run additional fidelity themes using `--themes` (comma-separated):

```bash
pnpm content:fidelity \
  --plan /tmp/plan.json \
  --baseline-url https://lmnas.com/en \
  --candidate-url http://localhost:3000/en \
  --themes dark,light
```

Apply behavior with gate:
- `pnpm content:apply --plan /tmp/plan.json` blocks when fidelity fails/missing for snapshot plans.
- `pnpm content:apply --plan /tmp/plan.json --force` overrides the gate.

## 7. Playwright Setup for Fidelity Capture

Install Playwright package (workspace root):

```bash
pnpm add -D playwright
```

Install browser binaries:

```bash
pnpm exec playwright install chromium
```

Expected fidelity artifacts (deterministic names):
- `fidelity-report-<slug>.json`
- `fidelity-<theme>.png`
- `baseline-<theme>.png`
- `fidelity-<theme>.diff.json`

If Playwright is not installed:
- `content:fidelity` fails with an explicit error instructing you to install `playwright` or `playwright-core`.

Stable output keys:
- `PLAN_PATH:`
- `APPLY:`
- `UPSERT_RESULT:`

Scope note:
- Phase 0 guarantees hero block onboarding baseline.
- FAQ block discovery exists through schema/manifest flow, but full FAQ mapping parity is not guaranteed in Phase 0.
