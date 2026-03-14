# TASK-004 - Studio Workflow Tightening Traceable Tasks

## Linked Spec: SPEC-004
## Governance Note
*This tightening package governs the current Studio workflow hardening pass. Earlier RR debt from Phase 0.1 inception (e.g. 001/002) may still exist outside this patch and must be tracked separately for future cleanup.*

---

## 7-Gate Development Constraints
- Gate 3/4: **Claude/Codex** execute Unit / Local E2E validation against the Tasks below.
- Gate 5/7: **Gemini** executes Independent Gap Validation matching Tasks to `SPEC-004`.

## Step-by-step Traceable Tasks

| Task ID | Linked REQs | Objective | Owner | Dependencies / Blockers | Validator Handoff Condition |
| --- | --- | --- | --- | --- | --- |
| `TSK-001` | REQ-THM-[01,02,03] | Implement Theme duplication trap, active state routing, sample previews, and Swatch UI. | Claude (UI) / Codex (Integr) | Needs `API/themes` route to handle collision errors natively. | Ensure duplicate trap halts 500 crashes; Swatch functions purely cosmetically. |
| `TSK-002` | REQ-BLK-[01,02,03], REQ-STU-01 | Eliminate standalone action mapping. Consolidate into Detection review. Add where-used trap. Define Browse as default list. | Claude (UI) | API where-used query availability across linked Pages. | Action routing 404s removed. Where-used warning blocks deletion of mapped blocks. |
| `TSK-003` | REQ-PUB-[01,02] | Integrate Fidelity Diff engine (Dark/Light tracking) and lock Publish screen to Active production theme. Build both "allow" and "disallow" threshold settings. | Claude (UI) | Configurable Studio Settings object fetching threshold modes (allow/disallow). | Publish logic proves tracking in allow-mode and actively prevents routing in disallow-mode. |
| `TSK-004` | REQ-PAG-[01,02] | Refactor HTML upload to extract purely atomic components. Block page slug gen. Apply Draft vs Prod page views. | Codex (Integr) | HTML Parser / AST builder | Ingesting a full HTML document yields exclusively blocks, zero page slugs. |
| `TSK-005` | REQ-SHL-01 | Build Shell Configuration menus (Navbar, Footer, Menu mapping) integrating the REQ-STU-01 shared component UX. | Claude (UI) | Shared Studio List/Detail CSS variables. | Shell UX saves Navbar states accurately against the global node. |
| `TSK-006` | REQ-WID-01 | Sandbox widget uploads rejecting raw manual JS. Enable code-first Widget discovery mapped against Layout placements testing functional behavior success. | Codex (Integr) | `tests/integration/widgets` repository setup. | Repo logic succeeds ingestion; UX proves active placement associations functioning smoothly. |
| `TSK-007` | REQ-CLN-01 | Construct E2E database teardown script for pre-flight testing establishing sterile baseline. | Codex (Integr) | Strapi Database admin/wipe privileges. | E2E explicitly calls wipe sequence dropping legacy faq/hero data prior to test execution. |
