# LMNAs Platform Operating Constitution v2.2

*(Intent-Based | Router-Driven | CMS-Governed | n8n-Orchestrated | AI-Enriched)*

> **Document Status:** Updated from v2.1 to enforce RR-first governance and strict workflow separation.
> **What Remains Unchanged:** Phase 0 Mandate (0), North Star (1), Inbound Flow Model (2), Content Governance (3), Strategic Router Model (4), Integration Architecture (5), Identity Resolution Model (6), and earlier Architectural Mandates (8).
> **What is Newly Added:** RR Governance Enforcement (7), Workflow Separation Model (9), Preview and Fidelity Model (10), Validation and Closure Mandates (11).
> **Refined:** Governance Enforcement -> now split into Content/Integration Governance and RR Governance.

------------------------------------------------------------------------

## 0. Phase 0 Stabilization Mandate

Before implementing Router, Identity, Blogs, Docs, or Personalization:

The platform must be structurally stable.

Stability Criteria:

-   Strapi preview works from website (Preview URL)
-   Strapi internal preview works for content managers
-   Renderer validates all blocks before render
-   Page-level conversion configuration is mandatory
-   SEO engine produces valid metadata and JSON-LD
-   No page renders without product mapping
-   No page renders without primary CTA defined
-   ESLint boundaries prevent architectural drift
-   Docker services boot reliably
-   Basic test suite passes

No further feature layers may be added until Phase 0 criteria are satisfied.

------------------------------------------------------------------------

## 1. North Star

Every session must resolve into an intent-classified state and lead to one of the following:

-   Book Appointment (Primary)
-   Send me the Full Report
-   Download (Gated Asset)
-   Subscribe (Fallback)

Conversion is intent-based and driven by entry point, persona, industry, and behavior.

------------------------------------------------------------------------

## 2. Inbound Flow Model

Authority Content → Website → Benefit Interaction → Intent Resolution → Conversion

Website is the central conversion engine.

------------------------------------------------------------------------

## 3. Content Governance

Strapi CMS is the single source of truth.

No content under LMNAs brand may surface without CMS authorization.

Applies to: - Website - Blogs - Docs - Social Media - Emails - Newsletters - Brochures

Every content piece must: - Map to Product - Map to Industry - Define Primary CTA - Include UTM strategy

------------------------------------------------------------------------

## 4. Strategic Router Model (Future Layer)

Router determines CTA hierarchy and benefit routing based on intent inputs.

Router will only be implemented after Phase 0 stabilization.

------------------------------------------------------------------------

## 5. Integration Architecture

Website communicates only with: - Strapi (CMS) - n8n (Integration Middleware)

Rudder SDK remains frontend event streaming engine.

Rudder forwards to: - GA4 - n8n

n8n connects to: - LENS CRM - LENS HR - Webinar system - Lead workflows

------------------------------------------------------------------------

## 6. Identity Resolution Model (Future Layer)

States: - Anonymous - Recognized - Known Lead - Customer

Transitions defined but not implemented until Phase 2.

------------------------------------------------------------------------

## 7. RR Governance Enforcement [NEW]

Hard enforcement required for Requirement & Roadmap (RR) alignment:

-   **RR-First Enforcement:** No implementation without explicitly linked Requirement (RR) IDs.
-   **No Speculative Implementation:** Absolutely no speculative implementation outside the approved RR scope. If architecture changes, Constitution/Spec must update *first*.
-   **Validator Independence:** The validator must be a separate entity/agent from the implementer. The validator must not fix the implementation; it reports gaps only.
-   **No Auto-Fixing:** Minor or cosmetic improvements by the validator cannot substitute for incomplete workflow execution or RR gap closure.

------------------------------------------------------------------------

## 8. Architectural Mandates

-   Schema-first development
-   Blocks are pure UI
-   Integrations via adapters
-   n8n centralizes workflows
-   CMS governs all content
-   Events unified through Rudder

------------------------------------------------------------------------

## 9. Workflow Separation Model [NEW]

The platform comprises strictly separated workflows. 

-   **Theme Workflow:** One-time/occasional project-level workflow. The system derives a project theme from a reference design. One active theme is frozen. Changing the active theme later may regress existing onboarded assets, and thus must be controlled. Theme browse/review/activate behavior must exist.
-   **Block Import Workflow:** Strictly for importing blocks. No full-page imports are allowed as a normal flow. No page creations. No page URLs/slugs. Publishing here creates reusable block/component structures only.
-   **Shell Workflow:** Shell variants are managed separately (navbar, footer, menu, submenu, shell actions). Only one shell can be active at a time; others remain inactive.
-   **Page Workflow:** Pages are assembled *only* from existing studio blocks. The active shell auto-applies. Page-level action configuration always overrides block defaults. External page sync updates Strapi page structures. Page content editing occurs strictly here.

------------------------------------------------------------------------

## 10. Preview and Fidelity Model [NEW]

-   **Reference vs. Production:** The Reference Preview is for checking source correctness. The Production Preview is the definitive, authoritative view for actual platform rendering (rendered through the active project theme).
-   **CDN Status:** Source CDN is *not* authoritative production truth.
-   **Import Mechanics:** Imports must be theme-aware and tokens-first. 
-   **Theme Debt:** Theme debt and fidelity reporting are mandatory. A Fidelity Score compares reference vs production. If low, adapt the source or revisit the Theme Workflow. One canonical target theme exists first.

------------------------------------------------------------------------

## 11. Validation and Closure Mandates [NEW]

-   **Evidence Over Claim:** No closure without concrete validation evidence. Screenshots are not enough without behavioral verification.
-   **Deviations:** If an implementation must deviate from the RR scope, the deviation must be documented and formally approved *before* closure.
-   **Sign-Off:** Only the Validator can confirm coverage matching the RR artifacts. Acceptance requires a recommendation of "Ready" or "Ready with Exceptions."

------------------------------------------------------------------------

End of Constitution v2.2
