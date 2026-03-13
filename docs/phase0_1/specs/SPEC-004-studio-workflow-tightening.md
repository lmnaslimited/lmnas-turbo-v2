# SPEC-004 - Studio Workflow Tightening Specification

## Linked Intake: INT-004
## Governance Note
*This tightening package governs the current Studio workflow hardening pass. Earlier RR debt from Phase 0.1 inception (e.g. 001/002) may still exist outside this patch and must be tracked separately for future cleanup.*

### Product Recovery Requirements Designation

**Canonical Delegation Notice:**
The product and UX behavior for the LMNAs Studio is now definitively governed by `docs/phase0_1/specs/lmnas_studio_product_recovery_spec_v_1.md`.

The following requirement IDs are formally registered into this technical specification, but their full narrative definitions are canonically housed in the Recovery Spec. The recovery spec may supersede prior product-layer UX and interaction expectations where inconsistent, but must not override accepted safety constraints, schema boundaries, slug suppression rules, publish safeguards, routing protections, or governed integration behavior:
- `REQ-REC-01` — Unified operator Studio workflow from import to publish
- `REQ-REC-02` — In-page content editing with clear page-local vs reusable-block behavior
- `REQ-REC-03` — First-class widget binding and action mapping in operator language
- `REQ-REC-04` — First-class theme swatch management and preview
- `REQ-REC-05` — Consistent create/edit/delete/duplicate/reorder/preview/publish interaction grammar across Studio surfaces

---

## 1. Studio-Wide Common Capabilities
- **[REQ-STU-01] Reusable Design Parity**
  - *Rationale*: Browse, edit, delete, and preview UX must not fragment across workflows.
  - *Statement*: All list/detail views must implement common class-based reusable designs.
  - *Acceptance*: Shell, Page, and Block workflows share identical UX list containers and action menu behaviors. Publish Verification overlays and Settings panels must also inherit and map to these shared workflow containers.

## 2. Theme Workflow
- **[REQ-THM-01] Bounded Inputs**
  - *Rationale*: Prevents ingestion of unparseable formats.
  - *Statement*: Allowed inputs are strictly: URL, HTML upload, Figma/Stitch export code, ZIP upload, and local repo/test path.
  - *Acceptance*: Reject uploads outside this MIME/source boundary with a clear UI error.

- **[REQ-THM-02] Theme State & Hierarchy**
  - *Rationale*: Safe browsing requires temporary visual states.
  - *Statement*: Themes exist as Active, Archived, or Preview-Only (Swatch). Swatches alter the UI but do not alter the production Active backend state.
  - *Acceptance*: Engaging a swatch alters the UI visually. A browser refresh reverts to the Active production theme.

- **[REQ-THM-03] Sample Previews & Duplicate Trap**
  - *Rationale*: Users must see the theme before activation; react key collisions crash the app.
  - *Statement*: Theme views must render a sample preview. Uploading identical themes must trigger a clean error trap preventing duplicate DB keys.
  - *Acceptance*: Duplicate uploads yield a warning dialog without a React render crash.

## 3. Block Workflow
- **[REQ-BLK-01] Browse as Default & Lifecycle Parity**
  - *Rationale*: UX consistency guarantees logical discovery.
  - *Statement*: Navigating to `/blocks` defaults to the grouped Browse view. Users can preview, edit, delete, activate, deactivate, and view a "where-used" list.
  - *Acceptance*: A block linked to an active Page cannot be deleted without satisfying the "where-used" dependency check.

- **[REQ-BLK-02] Detection Review UX**
  - *Rationale*: Removes orphan generic action mappings.
  - *Statement*: Action Mapping exists exclusively inside the Block Detection Review UI.
  - *Acceptance*: Standalone action mapping routes 404. Actions save natively to block instances.

- **[REQ-BLK-03] Fallback Rendering**
  - *Rationale*: Broken CDNs shouldn't crash previews.
  - *Statement*: Source rendering lacking an available CDN must fallback gracefully to the platform's Tailwind configuration.
  - *Acceptance*: Disconnecting the source network still allows structural block rendering in Studio preview.

## 4. Publish / Fidelity Behavior
- **[REQ-PUB-01] Active Theme Authorization**
  - *Rationale*: WYSIWYG guarantee limits deployment surprises.
  - *Statement*: Final Publish Review rendering relies 100% on the backend Active Production Theme (ignoring swatches).
  - *Acceptance*: Verification overlay directly calls the active Strapi Theme reference.

- **[REQ-PUB-02] Fidelity Configuration Toggle**
  - *Rationale*: Phase 0.1 agility vs Phase 1 strictness.
  - *Statement*: The fidelity threshold exists as a global Studio setting governing two operation modes: "allow-below-threshold" and "disallow-below-threshold". The engine captures Dark/Light fidelity diffs specifically when source HTML defines `@media(dark)`.
  - *Acceptance*: While configured to "allow" mode, threshold inversions yield warning logs but save cleanly. While configured to "disallow" mode, threshold inversions trigger a hard UX rejection, actively blocking the publish state.

## 5. Shell Workflow
- **[REQ-SHL-01] Global App Configuration**
  - *Rationale*: Current routing avoids tenancy complexity.
  - *Statement*: The platform operates a single global shell. The Shell Workflow natively supports browse, edit, config (Navbar/Footer), delete, and import parity mirroring blocks.
  - *Acceptance*: Navbar/Footer configuration updates are universally reflected.

## 6. Page Workflow
- **[REQ-PAG-01] Block-Exclusive Assembly**
  - *Rationale*: Prevent unstructured HTML blobs inside routing.
  - *Statement*: Pages generate exclusively via composition of approved Blocks. A full-page HTML import strictly extracts blocks; it never generates a Page route slug directly.
  - *Acceptance*: Full page HTML ingestion yields 0 new Route Slugs and X new Blocks in the DB.

- **[REQ-PAG-02] Preview & Edit Parity**
  - *Statement*: Pages mandate draft + production previews, alongside list, browse, and edit capabilities.

## 7. Widget Workflow
- **[REQ-WID-01] Repo-First Logic Separation**
  - *Rationale*: Secure Interactive code execution bounds.
  - *Statement*: Widgets represent Interactive Code. They onboard exclusively via repo-paths. URL/HTML ingestion is strictly for visual mocking. Widget placement seamlessly supports embed (inside Block) and reference (standalone) execution. Validation strictly demands functional logic mapping/association verifying the success path, however visual validation pixel parity remains non-mandatory for Phase 0.1 widgets.
  - *Acceptance*: Uploading raw `<script>` HTML logic fails securely; repo-mapped logic succeeds, associates visually with Studio blocks correctly, and functionally triggers its required interaction.

## 8. Cleanup / Test Baseline
- **[REQ-CLN-01] Strapi Testing Hygiene**
  - *Statement*: E2E testing strictly evaluates against a wiped/sterile Strapi instance deleting legacy demo blocks (faq/hero).
  - *Acceptance*: Test logs demonstrate baseline table wipe prior to HTML ingestion.

## 9. Validation / Governance Constraints
- **[REQ-GOV-01] Test Traceability**
  - *Statement*: Every `REQ` ID above mandates an explicit test row inside `TEST-004` and a designated evidence row inside `PROOF-004`.
  - *Acceptance*: Validator agent rejects tasks if `PROOF` lacks evidence explicitly linking the ID.
