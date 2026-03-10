# LMNAs Visual Onboarding Studio - Integration Evidence (2026-03-09)

Branch baseline: `ui-workflow-studio-complete`  
Head at verification: `414d85b`

## Mission Result

This pass focused on integration completeness (not cosmetic redesign).  
The studio now runs as 4 connected workflows with timeout-safe execution and end-to-end test coverage for analyze/publish/save/activate paths.

## Evidence Artifacts

### Analyze + Preview (Block Import)

- Visual snapshot: `blocks_reference_preview_20260309.png`
- Visual snapshot: `blocks_detection_review_20260309.png`
- Visual snapshot: `blocks_publish_preview_20260309.png`
- E2E log (analyze + map + publish + timeout regression):  
  `studio-workflows-e2e-20260309.log`

### Theme Workflow

- Existing walkthrough capture: `theme_detail_1773073113027.png`
- E2E log (load + browse + activate):  
  `studio-workflows-e2e-20260309.log`

### Shell Workflow

- Existing walkthrough capture: `shells_actions_1773073210957.png`
- E2E log (browse + edit + activate):  
  `studio-workflows-e2e-20260309.log`

### Page Workflow

- Existing walkthrough capture: `pages_library_1773073273028.png`
- E2E log (assemble + edit + override + save/publish + `/en/<slug>` check):  
  `studio-workflows-e2e-20260309.log`

## Commands Run

- `pnpm phase0:guard -- --id 002` (pass)
- `pnpm lint` (pass)
- `pnpm typecheck` (pass)
- `pnpm test` (fails in existing unrelated contracts test; see note below)
- `pnpm --filter @lmnas/integrations test` (pass)
- `pnpm exec vitest run apps/site/app/api/platform/studio/themes/activate/route.test.ts apps/site/app/api/platform/onboarding/analyze/route.test.ts apps/site/app/api/platform/onboarding/publish/route.test.ts` (pass)
- `pnpm exec playwright test -c playwright.config.ts apps/site/e2e/onboarding.visual.spec.ts --update-snapshots --reporter=list` (pass)
- `pnpm exec playwright test -c playwright.config.ts apps/site/e2e/studio-workflows.spec.ts apps/site/e2e/onboarding.visual.spec.ts --reporter=list` (pass, 1 `@real` skipped)
- `pnpm exec playwright test -c playwright.config.ts apps/site/e2e/studio-workflows.spec.ts --reporter=list --trace on` (pass)

## Note on Non-Studio Failure

`pnpm test` currently fails in `packages/contracts/src/contracts.test.ts` (`parses onboarding analysis payload`).  
This is outside the studio workflow surface and was not introduced by the studio integration test updates.
