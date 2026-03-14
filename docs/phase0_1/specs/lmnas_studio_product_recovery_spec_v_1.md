# LMNAs Studio Product Recovery Spec

## Status
Draft for immediate adoption

## Purpose
Reset LMNAs Studio from a technically partitioned implementation into a genuinely usable operator product.

This document replaces phase-slice thinking with one product truth:

**An operator must be able to import a design source, generate reusable blocks, assemble a page, connect widget behavior, apply a shell, preview the result, and publish — all through one simple, elegant, consistent Studio experience.**

This is the governing recovery spec for all future agent work on the Studio onboarding system until the operator can complete the full workflow end to end with minimal assistance.

---

# 1. Product Truth

LMNAs Studio is not a set of disconnected technical workflows.
It is one operator workflow.

The operator does not think in isolated technical subsystems.
The operator thinks in outcomes:

1. Bring in a source
2. See what the system understood
3. Clean up and confirm reusable parts
4. Assemble a working page
5. Attach behavior where needed
6. Apply the right shell/theme
7. Preview and verify
8. Publish safely

Every screen, interaction, API, and validation rule must support this product truth.

If any implementation is technically correct but weakens this operator flow, it is wrong.

---

# 2. Target User Outcome

A non-technical or lightly technical content/operator user should be able to:

- import from Stitch, Figma export, URL, or raw HTML
- get a proposed decomposition into theme, shell, page, blocks, and widget opportunities
- accept, edit, merge, delete, or create blocks easily
- assemble a page from blocks without confusion
- attach widget/workflow behavior to appropriate sections
- apply a shell and theme consistently
- preview draft behavior and live behavior clearly
- publish with confidence
- later reopen and modify any part without facing inconsistent rules

The user should not need to understand:

- internal schema shape
- route-generation mechanics
- raw payload trees
- repo-path internals
- Strapi entity structure
- implementation phase history

These remain internal concerns only.

---

# 3. Core Principle

## One Studio, not five subsystems

Theme, Block, Page, Widget, and Shell are internal object types.
They must not feel like disconnected products.

The Studio must feel like one system with one interaction grammar.

Every management surface must use the same mental model:

- list
- open
- create
- edit
- duplicate
- delete
- preview
- apply/save/publish

No object type may introduce surprising behavior unless absolutely unavoidable.
If special behavior exists, it must be explained in plain language within the UI.

---

# 4. Recovery Objective

The objective is not to prove bounded technical slices.
The objective is to make the Studio genuinely usable through one complete end-to-end workflow.

## Recovery success condition

The product is considered recovered only when an operator can complete the following E2E workflow without developer intervention:

**Import source -> system proposes structure -> operator confirms/refines blocks -> operator assembles page -> operator binds widget behavior -> operator applies shell/theme -> operator previews -> operator publishes**

If that flow is not smooth, the product is not yet successful.

---

# 5. The One Mandatory E2E Workflow

This is the primary governing workflow. All future implementation and validation must optimize for this exact flow.

## E2E-PRIMARY-01: Operator Onboards and Activates a Real Page

### Goal
Create one fully working page from an external source using the Studio UI alone.

### Entry
Operator starts with one source input:
- Stitch output, or
- Figma-derived export, or
- URL, or
- raw HTML

### Step 1: Import
The operator chooses an import source and submits it.

The Studio must:
- accept the source through a clean UI
- parse it without exposing technical complexity
- show progress/status in simple language
- present a structured result, not just raw ingestion output

### Step 2: Structure Proposal
The Studio proposes:
- theme signals
- shell signals
- page candidate
- extracted blocks
- possible widget hooks/interactions

The operator must be able to:
- accept a proposed block
- rename it
- merge duplicates
- split obviously incorrect groupings
- discard junk extractions
- create a new block manually if needed

### Step 3: Block Library Normalization
The approved blocks must be stored in a reusable block library.

The UI must make it easy to:
- inspect a block
- preview a block
- duplicate a block
- delete a block safely
- understand where a block is used

### Step 4: Page Composition and In-Page Content Editing
The operator assembles or confirms the page using approved blocks.

The page composer must allow:
- reorder
- add existing block
- remove block
- replace block
- duplicate block within page
- preview composition changes instantly or near-instantly
- edit block content directly while inside the page composer
- update headings, text, images, labels, and similar content without awkward workflow switching

The operator must always know:
- which page is being edited
- whether it is draft or published
- which shell/theme is currently applied
- whether a content change affects only this page instance or the reusable source block

Content editing from the page must be a first-class workflow.
The operator should not be forced into a technical jump between Page and Block management for normal content changes.

### Step 5: Widget Binding
Where interaction is needed, the operator binds a widget/workflow.

The widget UI must:
- present only approved widget choices
- explain what each widget does in user language
- attach it to a block/zone/action consistently
- prevent unsafe arbitrary code input
- make success/failure understandable

Widget behavior must feel like attaching a capability, not writing code.

### Step 6: Shell and Theme Application
The operator applies the appropriate shell and theme.

The UI must:
- show the current shell/theme clearly
- allow switching intentionally
- preview the result consistently
- avoid hidden coupling or surprising overrides

### Step 7: Preview
The operator previews the page in draft mode.

The preview must show:
- layout
- block order
- shell/theme effect
- widget behavior
- draft/live distinction clearly

### Step 8: Publish
The operator publishes when satisfied.

The publish experience must:
- clearly show what is about to go live
- confirm success or failure in plain language
- never feel like a developer API test tool

### Success Criteria
The full page is visible and working.
The structure remains manageable afterward.
The operator can reopen and edit without losing clarity.

This single E2E workflow is the product bar.

---

# 6. Required Product Surfaces

The Studio should be reorganized around operator tasks, not implementation phases.

## 6.1 Import Studio
Purpose: bring in source and see proposed structure.

Must support:
- Stitch / Figma export / URL / HTML inputs
- import status
- structure proposal review
- extraction warnings in plain language
- approve/refine flow

## 6.2 Block Library
Purpose: manage reusable content units.

Must support:
- list
- search/filter
- create
- open/edit
- duplicate
- delete
- usage visibility
- preview

## 6.3 Page Composer
Purpose: assemble pages from reusable blocks.

Must support:
- page list
- create/open page
- assign/edit slug intentionally
- reorder/add/remove/replace blocks
- draft/live visibility
- preview

## 6.4 Widget Binding and Action Mapping
Purpose: attach approved interactive behavior and map user actions cleanly.

Must support:
- list approved widgets
- attach/detach widget
- configure widget through plain fields
- validate allowed repo-bound behavior
- preview behavior safely
- map actions from UI elements in plain language

Action mapping must be a first-class operator capability.
The operator must be able to map actions such as:
- button click
- CTA click
- form submit
- modal open
- navigation
- download
- workflow launch
- handoff to an approved widget behavior

The action mapping UI must:
- make the trigger clear
- make the resulting action clear
- prevent unsafe arbitrary code input
- make success/failure understandable
- feel like configuration, not development

Widget behavior must feel like attaching a capability, not writing code.

## 6.5 Shell and Theme Manager
Purpose: control global presentation and page framing.

Must support:
- select theme
- select shell
- see effect clearly
- manage versions/draft state consistently
- manage theme swatches and visual tokens through a simple operator UI
- preview swatch and theme changes before publish

Theme swatches must be a first-class operator concept.
The operator must be able to:
- view available swatches
- edit swatch values through understandable controls
- see where a swatch is used
- preview the visual effect of a swatch change
- apply theme changes consistently across blocks, pages, and shells

The UI must avoid exposing raw token complexity unless explicitly in an advanced mode.

## 6.6 Publish Center
Purpose: verify and release changes confidently.

Must support:
- draft/live clarity
- change summary
- publish confirmation
- error handling in plain language

---

# 7. Mandatory UX Rules

## 7.1 Non-technical first
The UI must speak operator language, not implementation language.

Avoid exposing terms like:
- entity ids
- route mutation
- raw payload
- schema object
- execution path
- adapter mapping
unless hidden behind advanced/internal diagnostics.

## 7.2 Consistency over cleverness
The same actions must behave the same way across Theme, Block, Page, Widget, and Shell management.

## 7.3 Elegant simplicity
The Studio must feel light, not crowded.
Default screens should prioritize:
- clarity
- primary actions
- obvious next step
- low cognitive load

## 7.4 Safe deletion
Delete must always be understandable and protected:
- what is being deleted
- where it is used
- what breaks if removed

## 7.5 Preview everywhere it matters
Anything that materially affects the rendered result must be previewable before publish.

## 7.6 No hidden technical branching
The operator should not need to guess whether something belongs under Theme, Shell, Page, or Widget because of internal system design.
The UI must guide that naturally.

## 7.7 Reopenability
Anything created through onboarding must remain easy to reopen, inspect, modify, and reapply.

---

# 8. Product-Level Functional Rules

## 8.1 Import rules
- A source import must produce a structured proposal, not an opaque success/failure event.
- Imports must never silently create confusing live artifacts.
- Imports must surface low-confidence extraction areas clearly.

## 8.2 Block rules
- Blocks are reusable units.
- Blocks must be manageable independently of pages.
- Pages may use blocks repeatedly without creating hidden inconsistency.
- The system must clearly distinguish reusable source-block edits from page-instance content edits.

## 8.3 Page rules
- Pages are assembled from approved blocks.
- Page composition must be visually understandable.
- Slug or route behavior must be explicit and intentional, not inferred from arbitrary import behavior.
- Content must be editable directly from the page composition experience for normal operator use.
- When editing from a page, the UI must clearly communicate whether the change is page-local or reusable across pages.

## 8.4 Widget and action rules
- Widgets represent approved interactive capabilities.
- Widgets must never allow arbitrary unsafe code entry through the operator UI.
- Widget binding must feel like configuration, not development.
- Action mapping must be explicit, understandable, and safely constrained to approved behaviors.
- Operators must be able to map page and block actions without thinking in repo-path or code terms.

## 8.5 Shell rules
- Shells frame pages globally/predictably.
- Applying a shell must not create surprise layout changes without preview.

## 8.6 Theme rules
- Themes define visual language consistently.
- Theme changes must preview clearly before publish.
- Theme swatches must be editable through simple visual controls.
- Swatch usage and impact should be understandable before applying changes.
- Theme behavior must remain consistent across blocks, pages, and shells.

## 8.7 Publish rules
- Draft and live states must be unmistakable.
- Publish must communicate impact clearly.

---

# 9. Anti-Patterns That Must Be Eliminated

The following are considered recovery failures:

1. A workflow that feels like a developer admin panel instead of an operator studio.
2. A page onboarding flow that cannot be completed cleanly from import to preview.
3. UI inconsistency between Theme, Block, Page, Widget, Action Mapping, and Shell surfaces.
4. Raw technical structures leaking into routine operator actions.
5. Import generating artifacts that are hard to understand or manage later.
6. Widget binding or action mapping that feels like writing or pasting code.
7. Publish flow that feels like testing an API call rather than releasing content.
8. Separate subsystems that force the operator to mentally translate internal architecture.
9. Theme swatches being editable only through technical token knowledge.
10. Page content requiring awkward jumps into technical management screens for routine edits.

---

# 10. Agent Operating Rules Going Forward

This section is mandatory for all future AI agents working on the Studio.

## 10.1 Product-first rule
When making any decision, optimize for the operator end-to-end workflow, not technical phase completion.

## 10.2 End-user perspective rule
Every significant implementation choice must be judged by this question:

**Will this make the operator experience simpler, clearer, and more consistent?**

If not, do not proceed.

## 10.3 No local reinterpretation
Agents must not narrow requirements into technical sub-problems unless the resulting product still preserves the full operator workflow.

## 10.4 One-studio rule
Agents must treat Theme, Block, Page, Widget, and Shell as one unified Studio experience.

## 10.5 E2E priority rule
A passing slice is not success unless it improves the mandatory E2E workflow.

## 10.6 Operator-language rule
UI copy, labels, flows, and feedback must be understandable to a content/operator user.

## 10.7 Freeze the wrong complexity rule
If the current implementation contains technically clever but product-wrong complexity, agents should preserve stability only where necessary and simplify the user experience aggressively where safe.

## 10.8 No more prompt dependency rule
Agents must use this recovery spec as the standing product intent. The operator should not need to keep restating the same core expectation.

---

# 11. Definition of Usable for the Next Build

The next build is considered usable only if all of the following are true:

1. The operator can import a source and understand the result.
2. The operator can manage blocks comfortably.
3. The operator can compose a page without technical confusion.
4. The operator can attach widgets and map actions without thinking like a developer.
5. The operator can edit content directly from pages in a clear and controlled way.
6. The operator can manage theme swatches through a simple visual workflow.
7. The operator can apply shell/theme and preview consistently.
8. The operator can publish confidently.
9. Returning later to edit/delete/modify is easy and predictable.
10. The Studio feels elegant and consistent rather than nascent and technical.

If any of these fail, the product is not yet usable.

---

# 12. Recovery Validation Standard

All future validation must include both:

## 12.1 Product validation
Does the Studio feel simple, elegant, and coherent to an end user?

## 12.2 E2E validation
Can the operator complete the mandatory E2E workflow from import to publish with widgets and shell/theme applied?

A technically passing internal test suite is not enough.

---

# 13. Immediate Priority Order

## Priority 1
Make the one mandatory E2E workflow truly work and feel good.

## Priority 2
Unify the UI behavior across all Studio object types.

## Priority 3
Hide technical complexity from the operator.

## Priority 4
Make create / edit / delete / modify / preview consistent everywhere.

## Priority 5
Only after the above, refine advanced capabilities.

---

# 14. Final Instruction to Agents

Do not optimize for isolated gate passing.
Do not optimize for technically neat subsystem completion.
Do not optimize for internal architecture visibility.

Optimize for this:

**A content/operator user should be able to onboard, assemble, connect, preview, and publish a working page with confidence and very little friction.**

That is the product.
That is the standard.
That is the requirement.

# 15. Canonical Traceable Requirements Designations

To anchor product governance and testing, the following requirements are permanently and canonically established by this document:

- **`REQ-REC-01` — Unified operator Studio workflow from import to publish**: The Studio must functionally aggregate Theme, Shell, Page, Block, and Widget management into a single cohesive operator experience that hides internal technical partitioning (e.g., Strapi models, repo paths) from the UI.
- **`REQ-REC-02` — In-page content editing with clear page-local vs reusable-block behavior**: The Page Composer must allow direct content edits. The UI must explicitly distinguish whether an edit is page-local or mutates the source reusable block.
- **`REQ-REC-03` — First-class widget binding and action mapping in operator language**: Interactive behavior must be attached via UI-driven action mapping and widget configuration, strictly prohibiting arbitrary or unsafe code input from the operator.
- **`REQ-REC-04` — First-class theme swatch management and preview**: The system must provide visual swatch management with clear usage visibility and instant preview impact across blocks, pages, and shells.
- **`REQ-REC-05` — Consistent create/edit/delete/duplicate/reorder/preview/publish interaction grammar across Studio surfaces**: All Studio management views must utilize an identical interaction model, unifying the fragmented navigation patterns of prior iterations.

