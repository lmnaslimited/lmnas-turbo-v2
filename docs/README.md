# Operating Context

This repository embeds the authoritative LMNAs operating and architectural documents directly under `/docs`.

These documents define:

- Platform Constitution
- Operating Brief
- AI Website MVP Direction
- Master Operating Prompts (LMOP)
- GTM Architecture
- Product Architecture

---

## Canonical Locations

### Architecture (System-Level Governance)
Located under:
docs/architecture/

- architecture.md → Documentation router
- LMNAs_Platform_Operating_Constitution_v2_1.md → Non-negotiable system rules

This layer defines *how we build* and *what constraints apply*.

---

### Operating & Strategy (Execution Direction)
Located under:
docs/operating/strategy/

- 2026-02-17-LMNAS_OPERATING_BRIEF.md
- 2026-02-17-LMNAS_AI_Website_MVP_Operating_Brief.md
- LMNAs_Master_Operating_Prompt_v1.0.md
- LMNAs_Master_Operating_Prompt_v1.1_GTM.md
- LMNAs_Master_Operating_Prompt_v1.2_Product_Architecture.md

This layer defines *what we are executing* and *why*.

---

## Codex Governance

Codex IDE reads `AGENTS.md` (repo root).

`AGENTS.md` references the documents above and enforces:

- Schema-first block design
- No hardcoded content in UI
- Mandatory fixtures + tests
- Conversion governance (productMapping + conversionConfig)

If a document path changes:
1) Update `architecture.md`
2) Update `AGENTS.md`
3) Update this README

---

## If Using lmnas-context as External Source

If this repo is linked to `lmnas-context` via submodule:

Update context using:

git submodule update --remote --merge

However, Codex only follows documents available inside this repository.
If the submodule is not initialized locally, governance files will not be visible.

---

## Principle

Architecture and governance are embedded in the repository.
We do not rely on memory or verbal instructions.
We encode rules directly into the project.