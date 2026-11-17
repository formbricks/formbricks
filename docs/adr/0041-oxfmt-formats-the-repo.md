---
status: accepted
---

# oxfmt formats the repo, pinned while it is pre-1.0

oxfmt replaces Prettier and its plugins as the repo's only formatter (ENG-7328), even though it is still 0.x. It keeps one Oxc toolchain with oxlint, sorts imports and Tailwind classes itself, and formats the whole repo in about two seconds, which makes formatting cheap enough to run after every agent edit. A full reformat of the repo with it changed 55 files, every one without changing meaning. Because its minor releases still change output, oxfmt is pinned to an exact version, and each bump arrives as its own PR that carries the reformat.

## Considered Options

- **Stay on Prettier.** It was the slowest step in the lint loop, and it needed three plugins.
- **Biome.** Its formatter is stable, but its linter overlaps with oxlint, and it cannot sort Tailwind classes while it formats.

## Consequences

- oxfmt does not sort JSON keys. Only locale files must keep sorted keys, and a repo check enforces that. Other JSON files keep the order their authors chose.
- oxfmt does not sort the names inside an import's braces. oxlint's `sort-imports` rule enforces and fixes that order instead.
- Formatting has no per-package presets: one root config covers every workspace, with per-path overrides only where Tailwind needs a package's own theme.
