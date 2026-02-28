# Phase 0 Release Notes

## Included
- Strapi v5 GraphQL schema introspection.
- Safe-read importer flow for broken CMS records.
- Deterministic upsert behavior.
- Deterministic slug uniqueness handling for force-create flows.
- `content:onboard` one-command workflow.
- Test coverage for onboarding and apply repair/upsert paths.

## Known Limitations
- Hero onboarding is the guaranteed baseline.
- FAQ block can be discovered/read, but full FAQ mapping parity is not guaranteed.
- No full-section page segmentation yet.
- No bulk multi-page onboarding flow yet.
- No visual diff tooling.

## Not Included
- Router logic.
- Personalization.
- Analytics automation.
- Full manifest-driven rendering parity for every future block type.

## Next Phase (Phase 1 Candidates)
- Complete FAQ mapping.
- Expand section import coverage.
- Strengthen manifest-driven rendering parity across additional blocks.
- Diff-aware updates (changed blocks only).
- CI gate for plan drift validation.

## Release Branch and Tag (Manual)
Use only after tests pass:

```bash
git checkout -b release/phase0-stable
git add .
git commit -m "Phase 0 stable baseline"
git tag phase0.0.0
git push origin release/phase0-stable --tags
```

Tag only after the full test suite is green.
