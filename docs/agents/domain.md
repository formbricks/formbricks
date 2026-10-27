# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This is a single-context repo: one glossary and one ADR folder for the whole monorepo, with terms grouped under headings by area.

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-public-chart-query-is-the-cube-query.md
│   └── 0002-the-app-uses-the-public-dashboard-api.md
├── apps/
└── packages/
```

`docs/adr/` is excluded from the Mintlify docs site by `docs/.mintignore`; ADRs are engineering records, not product docs.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0002 (the app uses the public dashboard API), but worth reopening because…_
