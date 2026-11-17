import { defineConfig } from "oxfmt";

/*
 * The repo's only formatter config (docs/adr/0041-oxfmt-formats-the-repo.md). `pnpm format` writes,
 * `pnpm format:check` is the CI gate, the lint-staged hook formats every staged file, and the Claude Code
 * hook formats each file an agent edits. There are no nested configs: formatting is the same in every
 * workspace, and the only per-path settings are the Tailwind themes in `overrides` below.
 *
 * oxfmt does not sort JSON keys. Locale files keep sorted keys through scripts/sort-locale-keys.mjs,
 * which `pnpm format` and `pnpm format:check` run after oxfmt. Every other JSON file keeps its authors'
 * order. oxfmt does not sort the names inside an import's braces either: oxlint's `sort-imports` rule
 * (packages/config-oxlint/base.mjs) does.
 */

// Class-merging helpers whose string arguments are Tailwind classes, sorted like `className`.
const tailwindFunctions = ["cn", "clsx", "cva", "twMerge"];

export default defineConfig({
  printWidth: 110,
  trailingComma: "es5",
  bracketSpacing: true,
  bracketSameLine: true,
  singleQuote: false,
  jsxSingleQuote: false,
  semi: true,
  arrowParens: "always",
  // oxfmt sorts package.json by default, in an order nobody here chose; script order is deliberate.
  sortPackageJson: false,
  sortImports: {
    // Case-sensitive, so uppercase sorts first: the order the Prettier import plugin produced.
    ignoreCase: false,
    newlinesBetween: false,
    // Side-effect imports sort into their group too, so `import "server-only"` lands at the top.
    sortSideEffects: true,
    internalPattern: [],
    customGroups: [
      // Mock modules first: importing one is what replaces the real module for the rest of the file.
      { groupName: "mocks", elementNamePattern: ["**/__mocks__/**"] },
      { groupName: "server-only", elementNamePattern: ["server-only"] },
      { groupName: "formbricks", elementNamePattern: ["@formbricks/**"] },
      { groupName: "tilde", elementNamePattern: ["~/**"] },
      { groupName: "at", elementNamePattern: ["@/**"] },
    ],
    groups: [
      "mocks",
      "server-only",
      ["builtin", "external", "unknown"],
      "formbricks",
      "tilde",
      "at",
      ["parent", "sibling", "index"],
    ],
  },
  sortTailwindcss: { functions: tailwindFunctions },
  // Each Tailwind workspace sorts against its own theme, so its custom utilities sort where Tailwind
  // puts them instead of first as unknown classes.
  overrides: [
    {
      files: ["apps/web/**"],
      options: {
        sortTailwindcss: { stylesheet: "./apps/web/modules/ui/globals.css", functions: tailwindFunctions },
      },
    },
    {
      files: ["packages/survey-ui/**"],
      options: {
        sortTailwindcss: {
          stylesheet: "./packages/survey-ui/src/styles/globals.css",
          functions: tailwindFunctions,
        },
      },
    },
    {
      files: ["packages/surveys/**"],
      options: {
        sortTailwindcss: {
          stylesheet: "./packages/surveys/src/styles/global.css",
          functions: tailwindFunctions,
        },
      },
    },
  ],
  // oxfmt also skips everything in .gitignore. These are tracked files it must not touch.
  ignorePatterns: [
    // Generated artifacts: the tool that writes them would immediately undo any formatting, which would
    // turn `pnpm format:check` red on an unrelated PR.
    "pnpm-lock.yaml",
    ".devcontainer/devcontainer-lock.json",
    "docs/api-v3-reference/openapi.yml",
    "docs/schemas/",
    "docs/api-v3-reference/.redocly.lint-ignore.yaml",
    "charts/**/README.md",
    "charts/spicedb-operator/crds/authzed.com_spicedbclusters.yaml",
    "charts/spicedb-operator/files/update-graph.yaml",
    // Prisma writes it without a trailing newline on every new migration.
    "packages/database/migration/migration_lock.toml",

    // Agent skills installed from upstream and pinned by hash in skills-lock.json. The next `skills`
    // update overwrites any local formatting, so leave them as shipped.
    ".agents/skills/",
    "skills-lock.json",

    // Helm templates are Go templates that only look like YAML: the YAML parser cannot parse them.
    "charts/**/templates/",

    // The MDX printer treats Markdown inside JSX children as a single text block and re-wraps it, so lists
    // and numbered steps inside Mintlify components (<Step>, <Accordion>, <Tab>, …) collapse into one
    // paragraph. Formatting the docs would silently change what they render.
    "**/*.mdx",

    // Intentional empty list items are the fill-in placeholders of this form; the formatter folds them
    // into the label above and changes the template.
    ".github/pull_request_template.md",

    // Partly owned by a generator: .agents/install.sh rewrites the `robots:start` block, and the
    // formatter wants a blank line after that marker where the installer emits none. Ignoring is
    // per-file, not per-region, so the whole file is out — otherwise every regeneration of the block turns
    // format:check red on whichever unrelated PR happens to carry it.
    "AGENTS.md",
  ],
});
