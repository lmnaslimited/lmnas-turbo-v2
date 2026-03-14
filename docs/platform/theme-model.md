# Theme Model

## Scope Rule

Theme is platform/page scoped, not block owned.

## Rendering Rule

Importer preserves source fidelity first, then reports tokenization debt.

## Token-First Direction

- Prefer platform tokens for color/type/spacing/radius/shadow.
- Keep arbitrary values only as controlled exception.
- Report arbitrary value usage as theme debt.

## Fidelity Definition

Fidelity quality is expressed through:
- shell detection coverage
- block structure match ratio
- low-confidence mapping count
- token-first class ratio
- arbitrary utility count

## Theme Debt Definition

Theme debt exists when imported styling cannot be represented by platform token system without losing fidelity.

Debt signals:
- high arbitrary utility count
- low token-first ratio
- unresolved shell or block warnings
