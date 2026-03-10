# ADR-004 - Studio Workflow Tightening Decisions

Consolidated architectural decisions enforcing the boundaries of Phase 0.1 Studio Workflows.

---

### ADR-004A: Removal of Standalone Action Mapping Workflow
- **Decision**: Fold Action Mapping securely into Block Detection Review.
- **Status**: Accepted
- **Consequences**: Simplifies navigation and correctly couples actions to instances. Prevents generic action bleed.
- **Open issues**: None.
  
### ADR-004B: Production-Theme-Authoritative Publish Rule
- **Decision**: Final publish reviews render exclusively via the active production theme. Swatches are strictly visual emulators.
- **Status**: Accepted
- **Consequences**: Guarantees WYSIWYG for live site rendering. Removes ambiguity regarding what the customer will actually see.
- **Open issues**: None.

### ADR-004C: Strict Page Composition from Approved Blocks
- **Decision**: Disallow direct page creation routing from a full html-page import. Forces atomic extraction first.
- **Status**: Accepted
- **Consequences**: Enforces strict atomic design governance. Increases steps for the user but eliminates unstructured page blobs.
- **Open issues**: None.

### ADR-004D: Global Shell Model for Phase 0.1
- **Decision**: Maintain a single active app/site shell, avoiding page-specific shells for now, yet maintaining full CRUD for shell variants.
- **Status**: Accepted
- **Consequences**: Drastically simplifies Phase 0.1 routing and composition logic. Page-level shell overriding is deferred to Phase 0.2.
- **Open issues**: How are different tenant brands handled if the app is multi-tenant? (Assumed single-tenant for Phase 0.1).

### ADR-004E: Widget Separation and Repo-First Onboarding Model
- **Decision**: Widgets are logic elements prioritized via codebase referencing (repo-first). HTML/URL mapping is strictly for visual mockups.
- **Status**: Accepted
- **Consequences**: Protects the pure-UI block extraction flow from failing on complex interactive React elements. Requires developers to onboard complex integrations via code.
- **Open issues**: None.

### ADR-004F: Studio-Level Theme Swatch as Preview-Only
- **Decision**: Ensure cross-studio swatch usage acts strictly as a visual emulator and never alters the canonical backend active state.
- **Status**: Accepted
- **Consequences**: Safely allows experimentation. Requires clear UI badges indicating "Preview Mode" so users aren't confused.
- **Open issues**: None.

### ADR-004G: Configurable Fidelity Threshold Strategy
- **Decision**: The fidelity threshold exists as a Studio Configuration to warn, rather than strictly block, publishing during Phase 0.1.
- **Status**: Accepted
- **Consequences**: Allows flexibility during early Phase 0.1 ingestion. Long-term, this configuring will flip to "hard block".
- **Open issues**: None.
