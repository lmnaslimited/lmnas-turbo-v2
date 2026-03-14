# PROOF-004 - Studio Workflow Tightening

## Linked Spec: SPEC-004

## 2026-03-14 implementation pass

- Binding authority: Constitution v2.1.
- `Codex`: implementation and executable evidence in this pass.
- `ChatGPT`: architecture review required after this proof update.
- `Arun`: functional / UX review required after this proof update.
- `Gemini`: independent validation remains required; no code changes by validator.

## Executable evidence

| Command | Result |
| --- | --- |
| `bash -lc 'rg -n "Constitution v2\\.2 is authoritative|Must inherit Constitution v2\\.2|Constitution v2\\.2 reflects explicit rules" README.md docs/phase0_1 docs/architecture -S || true'` | no matches |
| `pnpm exec vitest run apps/site/app/page.test.tsx 'apps/site/app/[...slug]/page.test.tsx' apps/site/lib/studio-page-runtime.test.ts apps/site/lib/studio-html-sanitizer.test.ts apps/site/app/api/platform/studio/reset/route.test.ts apps/site/app/api/platform/studio/settings/route.canonical.test.ts apps/site/app/api/platform/studio/shells/route.canonical.test.ts apps/site/app/api/platform/studio/shells/activate/route.test.ts apps/site/app/api/platform/studio/themes/route.canonical.test.ts apps/site/app/api/platform/studio/themes/activate/route.canonical.test.ts apps/site/app/api/platform/studio/pages/route.test.ts apps/site/app/api/platform/studio/widgets/route.canonical.test.ts apps/site/app/api/platform/studio/widgets/execute/route.test.ts apps/site/app/api/platform/studio/publish/route.test.ts apps/site/app/api/platform/studio/publish/route.canonical.test.ts apps/site/app/api/platform/studio/import/process/route.test.ts` | `16` files passed, `52` tests passed |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 PLAYWRIGHT_SKIP_WEBSERVER=1 LMNAS_E2E_REAL_STACK=1 pnpm exec playwright test -c playwright.config.ts apps/site/e2e/studio-public-route.real.spec.ts` | `1` passed |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 PLAYWRIGHT_SKIP_WEBSERVER=1 LMNAS_E2E_REAL_STACK=1 pnpm exec playwright test -c playwright.config.ts apps/site/e2e/studio-page-preview-publish.real.spec.ts` | `1` passed |

Supplemental persisted evidence:

- `docs/phase0_1/proof/evidence/h011/tv-e2e-11-page-preview-publish.json`

Screenshots were not used as gate-closing evidence in this pass.

## Gate matrix

| Gate | Files changed | Tests run | Result | Remaining risk |
| --- | --- | --- | --- | --- |
| 0 | `README.md`, `docs/architecture/LMNAs_Platform_Operating_Constitution_v2_2.md`, `docs/phase0_1/intake/INT-003-rr-governance-enforcement.md`, `docs/phase0_1/intake/INT-004-studio-workflow-tightening.md`, `docs/phase0_1/tasks/TASK-003-rr-governance-enforcement.md`, `docs/phase0_1/specs/SPEC-003-rr-governance-enforcement.md`, `docs/phase0_1/proof/PROOF-003-rr-governance-enforcement.md`, `docs/phase0_1/tests/TEST_OWNERSHIP_AND_VALIDATION_ADDENDUM.md`, `docs/phase0_1/WORKSTREAM.md` | documentation audit + authority grep | Closed | Requires ChatGPT architecture review acknowledgement, but binding-authority drift is removed from repo docs. |
| 1 | `apps/site/app/api/platform/studio/pages/route.ts`, `apps/site/app/api/platform/studio/settings/route.ts`, `apps/site/app/api/platform/studio/shells/route.ts`, `apps/site/app/api/platform/studio/shells/activate/route.ts`, `apps/site/app/api/platform/studio/themes/route.ts`, `apps/site/app/api/platform/studio/themes/activate/route.ts`, `apps/site/app/api/platform/studio/widgets/route.ts`, `apps/site/app/api/platform/studio/widgets/execute/route.ts`, `apps/site/app/api/platform/studio/reset/route.ts`, `apps/site/app/api/platform/studio/publish/route.ts`, `apps/site/app/api/platform/studio/_lib/canonical-isolation.ts` | canonical route tests in the Vitest command above, including `import/process/route.test.ts` for debug-fallback guard | Closed | Dev fallback still exists only behind explicit `STUDIO_DEBUG_ALLOW_IMPORT_FALLBACK=1`. |
| 2 | `apps/site/lib/studio-page-runtime.ts`, `apps/site/lib/studio-runtime-page-view.tsx`, `apps/site/app/page.tsx`, `apps/site/app/[...slug]/page.tsx`, `apps/site/public/studio-runtime.css` | `studio-page-runtime.test.ts`, `page.test.tsx`, `[...slug]/page.test.tsx`, `studio-public-route.real.spec.ts` | Closed | Runtime now serves governed render blocks, not route-level raw snapshot HTML. |
| 3 | `apps/site/lib/studio-page-runtime.ts`, `apps/site/app/api/platform/studio/publish/route.ts`, `apps/site/app/api/platform/studio/pages/route.ts` | `studio-page-runtime.test.ts`, `publish/route.canonical.test.ts`, `studio-public-route.real.spec.ts`, `studio-page-preview-publish.real.spec.ts` | Closed | Runtime blocks invalid records and preserves published/live isolation after later draft edits. |
| 4 | `apps/site/lib/route-metadata.ts`, `apps/site/app/page.tsx`, `apps/site/app/[...slug]/page.tsx`, `apps/site/e2e/studio-public-route.real.spec.ts`, `apps/site/e2e/studio-page-preview-publish.real.spec.ts` | route tests + both real-stack Playwright specs | Closed | Metadata / JSON-LD and preview-vs-live separation are now exercised on real stack. |
| 5 | `apps/site/lib/studio-html-sanitizer.ts`, `apps/site/app/platform/onboarding/_lib/platform-preview.ts`, `apps/site/app/platform/onboarding/pages/preview/page.tsx`, `apps/site/app/platform/onboarding/widgets/page.tsx`, `docs/phase0_1/proof/PROOF-001A-snapshot-sanitizer.md` | `studio-html-sanitizer.test.ts`, `studio-page-runtime.test.ts` | Closed | Allowlist sanitizer is active on remaining snapshot HTML surfaces used in Phase 0.1. |
| 6 | `apps/site/app/api/platform/studio/settings/route.ts`, `apps/site/app/api/platform/studio/publish/route.ts` | covered indirectly only | Open | Fidelity settings still persist through `themeDebt` markers instead of first-class canonical studio settings. |
| 7 | `apps/site/e2e/studio-page-preview-publish.real.spec.ts`, `apps/site/e2e/studio-public-route.real.spec.ts`, `apps/site/app/platform/onboarding/pages/page.tsx`, `apps/site/app/platform/onboarding/publish/page.tsx` | page/public real-stack flows above | Partial | Page create/edit/preview/publish/reopen parity improved, but rename/menu parity across theme/shell/widget flows is still not covered end-to-end. |
| 8 | `docs/phase0_1/proof/PROOF-004-studio-workflow-tightening.md`, `docs/phase0_1/WORKSTREAM.md` | commands recorded in this proof | Closed | Combined multi-spec Playwright invocation is unstable in this macOS sandbox; acceptance is based on clean single-spec runs recorded above. |
| 9 | `docs/phase0_1/proof/PROOF-003-rr-governance-enforcement.md`, `docs/phase0_1/proof/PROOF-004-studio-workflow-tightening.md`, `docs/phase0_1/tests/TEST_OWNERSHIP_AND_VALIDATION_ADDENDUM.md`, `docs/phase0_1/WORKSTREAM.md` | documentation audit | Closed | RR and proof docs now match actual implementation/evidence and explicitly mark open gates. |

## Open gate blockers

### Gate 6

- File: `apps/site/app/api/platform/studio/settings/route.ts`
  - Blocker: canonical fidelity mode / threshold is still encoded and parsed from `themeDebt`.
- File: `apps/site/app/api/platform/studio/publish/route.ts`
  - Blocker: publish still resolves fidelity settings through `parseSettingsFromThemeDebt(...)`.
- Recommended next change:
  - introduce first-class canonical studio settings persistence in Strapi and migrate fidelity fields off `themeDebt`.

### Gate 7

- File: `apps/site/app/platform/onboarding/theme/page.tsx`
  - Blocker: no real-stack parity coverage for create / rename / edit / reopen flows.
- File: `apps/site/app/platform/onboarding/shells/page.tsx`
  - Blocker: no real-stack parity coverage for per-item menu and reopen/edit flow consistency.
- File: `apps/site/app/platform/onboarding/widgets/page.tsx`
  - Blocker: no real-stack parity coverage for per-item action parity.
- File: `apps/site/app/platform/onboarding/pages/page.tsx`
  - Blocker: page preview/publish flow is covered, but rename/menu parity is still missing from Playwright.
- Recommended next change:
  - add real-stack Playwright specs that exercise create / rename / edit / preview / publish / reopen parity across theme, shell, widget, and page workflows.

## Release note summary

- Public studio runtime now serves governed structured content with runtime governance checks, metadata, and JSON-LD.
- Canonical CMS routes no longer silently degrade to fallback stores in configured mode across pages, shells, themes, settings, widgets, reset, and publish paths.
- Draft/live isolation is preserved after publish: later draft edits no longer leak to the public route.
