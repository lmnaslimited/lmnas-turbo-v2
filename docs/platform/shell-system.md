# Shell System

## Architecture

Shells are first-class platform structures, not ordinary content blocks.

Core entities:
- `ShellVariant`
- `NavbarVariant`
- `FooterVariant`
- `NavigationMenu`
- `NavigationItem`
- `NavigationGroup`
- `FooterColumn`
- `FooterLegalStrip`
- `ShellAssignment`

## Assignment Rules

- Site-level default shell assignment allowed.
- Page-level shell assignment can override site default.
- Assignment binds a shell variant, and optionally specific navbar/footer variant IDs.

## Submenus

- `NavigationItem.children` supports nested menus.
- Depth is intentionally constrained for operator clarity.

## Mobile Behavior

- Navbar variants store mobile behavior mode (`drawer`, `overlay`, `inline`).
- Runtime shell renderer consumes variant metadata.

## Import Detection Rules

Shell detector currently infers candidates from:
- `<nav>` and `<header>` sections for navbar candidates
- `<footer>` sections for footer candidates
- class/id keyword heuristics for announcement/utility bars
- anchor extraction for menu item proposals

## Preview Safety

Shell changes are validated in onboarding dry-run payload before apply.
