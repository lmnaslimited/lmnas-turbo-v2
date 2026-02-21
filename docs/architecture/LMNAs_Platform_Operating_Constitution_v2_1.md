# LMNAs Platform Operating Constitution v2.1

(Intent-Based \| Router-Driven \| CMS-Governed \| n8n-Orchestrated \|
AI-Enriched)

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

No further feature layers may be added until Phase 0 criteria are
satisfied.

------------------------------------------------------------------------

## 1. North Star

Every session must resolve into an intent-classified state and lead to
one of the following:

-   Book Appointment (Primary)
-   Send me the Full Report
-   Download (Gated Asset)
-   Subscribe (Fallback)

Conversion is intent-based and driven by entry point, persona, industry,
and behavior.

------------------------------------------------------------------------

## 2. Inbound Flow Model

Authority Content → Website → Benefit Interaction → Intent Resolution →
Conversion

Website is the central conversion engine.

------------------------------------------------------------------------

## 3. Content Governance

Strapi CMS is the single source of truth.

No content under LMNAs brand may surface without CMS authorization.

Applies to: - Website - Blogs - Docs - Social Media - Emails -
Newsletters - Brochures

Every content piece must: - Map to Product - Map to Industry - Define
Primary CTA - Include UTM strategy

------------------------------------------------------------------------

## 4. Strategic Router Model (Future Layer)

Router determines CTA hierarchy and benefit routing based on intent
inputs.

Router will only be implemented after Phase 0 stabilization.

------------------------------------------------------------------------

## 5. Integration Architecture

Website communicates only with: - Strapi (CMS) - n8n (Integration
Middleware)

Rudder SDK remains frontend event streaming engine.

Rudder forwards to: - GA4 - n8n

n8n connects to: - LENS CRM - LENS HR - Webinar system - Lead workflows

------------------------------------------------------------------------

## 6. Identity Resolution Model (Future Layer)

States: - Anonymous - Recognized - Known Lead - Customer

Transitions defined but not implemented until Phase 2.

------------------------------------------------------------------------

## 7. Governance Enforcement

Hard enforcement required:

-   No page without conversion configuration
-   No product page without mapped benefit
-   No content without taxonomy
-   No integration without specification
-   No block rendering without schema validation

------------------------------------------------------------------------

## 8. Architectural Mandates

-   Schema-first development
-   Blocks are pure UI
-   Integrations via adapters
-   n8n centralizes workflows
-   CMS governs all content
-   Events unified through Rudder

------------------------------------------------------------------------

End of Constitution v2.1
