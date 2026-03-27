# Block Registry — Codex Orientation

This package maps block type → component.

## Rules
- Validate block with schema before rendering.
- Throw on invalid block.
- Do not contain UI markup here.
- No business logic.

Example:

registry["hero_v1"] = HeroV1