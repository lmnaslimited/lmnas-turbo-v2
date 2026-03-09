# Shell System

## First-Class Shell Objects

- Navbar
- Footer
- Utility bar
- Announcement bar

Shells are not ordinary blocks.

## Governed Structures

- `ShellVariant`
- `NavbarVariant`
- `FooterVariant`
- `NavigationMenu`
- `NavigationItem`
- `NavigationGroup`
- `FooterColumn`
- `FooterLegalStrip`
- `ShellAssignment`

## Detection Rules

Importer detects and proposes:

- navbar candidates
- footer candidates
- utility/announcement bars
- menu and submenu hierarchy
- shell CTA labels

## Assignment Rules

- Site-level shell assignment for global default
- Page-level shell assignment for exceptions
- Navbar and footer variant can be overridden independently

## Mobile / Behavior

Navbar supports:

- sticky or static behavior
- mobile behavior (`drawer`, `overlay`, `inline`)
- CTA slot handling

## Operator Controls

Operators can:

- choose shell variant
- map to existing shell models
- edit menu/submenu labels and destinations
- preview shell updates safely before publish
- review shell cards with visual thumbnails and import/skip controls
