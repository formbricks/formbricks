# `@formbricks/config-prettier`

Shared Prettier preset for the Formbricks monorepo (110-char width, semicolons, double quotes, import-order groups).

The preset lives in `prettier-preset.js` and is consumed by **relative path**, not by package name — Prettier resolves `require`s from the config file's location:

- the workspace root `.prettierrc.js` spreads it and adds the plugins (sort-imports, tailwindcss, sort-json), which this package pins as `devDependencies`;
- `packages/js-core/.prettierrc.cjs` extends it the same way.
