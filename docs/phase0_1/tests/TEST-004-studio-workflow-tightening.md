# TEST-004 - Studio Workflow Tightening Validators Pack

## Test Ownership
Execution: `Gemini` (Independent Validator)
Retest Constraints: Medium/Low triggers targeted fix loop. Critical/High triggers full regression.

## Mandatory Minimum E2E Execution Path
1. Extract a completely wiped, sterile Strapi local database (`REQ-CLN-01`).
2. Supply `docs/testing-artifacts/code.html` to generate Theme.
3. Resupply the identical HTML to assert Duplicate Trap prevents creation.
4. Extract Shells from the baseline asset.
5. Extract Blocks from the baseline asset.
6. Assemble a Page consuming pure blocks.
7. Attempt (and ensure failure of) an attempted full-page import generation.
8. Assert DB persistence explicitly maps the front-end UI visual.
9. Assemble a secondary Page with the existing Blocks to guarantee component isolation.

## Matrix Validation Paths

### Theme Workflow
- [ ] Theme states: Validate Active vs Archive toggle.
- [ ] Preview Swatch: Assert global swatch forces UI recalculation but leaves Prod backend immutable.
- [ ] Deletion: Delete -> Refresh -> Verify gone.

### Block Workflow
- [ ] Navigate to `/platform/onboarding/blocks`. Assert **Browse** operates as default.
- [ ] Verify Action mapping logic requires direct block instance contextual mapping. Generic mapping URLs should 404 or redirect.
- [ ] Test Fallback: Ingest block lacking CDN references, assert Tailwind fails gracefully matching generic system definitions.

### Fidelity Behaviors
- [ ] Ingest HTML explicitly declaring `@media (prefers-color-scheme: dark)`. Assert platform Studio light/dark toggles flip UI display flawlessly.
- [ ] Utilize final Publish Review UI. Visually assert it guarantees active **production** thematic rules, ignoring temporary swatches.

### Shell Constraints
- [ ] Interrogate Shell context lists (Navbar/Footers). Change config properties and assert real-time UI mapping parity updates.

### Widget Segregation
- [ ] Upload an interactive logic element manually directly avoiding code repos. Assert system pushes towards repo-onboarding limits, blocking dangerous raw JS script ingestion.
