#!/usr/bin/env node
/**
 * Post-build guard for the standalone stylesheet (dist/survey-ui.css).
 *
 * The scoping PostCSS plugins (packages/vite-plugins/postcss-scope-fbjs.cjs) match
 * Tailwind's CURRENT emission shapes exactly (`@layer properties`, bare `:root` /
 * `:host` selectors). Their unit tests feed a frozen fixture, so a future Tailwind
 * upgrade that changes the emitted shape (e.g. `:root:where(...)`) would slip past
 * the plugins AND the tests. This script asserts against the real build artifact
 * instead: if any forbidden global pattern survives into dist/survey-ui.css, the
 * build fails — a dependency bump cannot silently reintroduce host-page pollution.
 *
 * Run automatically after `vite build` (see the package build script).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cssPath = resolve(import.meta.dirname, "../dist/survey-ui.css");

let css;
try {
  css = readFileSync(cssPath, "utf8");
} catch {
  console.error(`[assert-scoped-css] ${cssPath} not found — run after vite build.`);
  process.exit(1);
}

// Forbidden global patterns. Selector checks look for :root/:host used as the start
// of a selector (optionally inside :where/:is or with chained pseudo-classes) rather
// than requiring an exact bare match, so shape changes like `:root:where(...)` are
// still caught. `#fbjs :root`-style descendants cannot occur (html can't nest), so
// any occurrence outside a #fbjs-prefixed selector is a leak.
const violations = [];

if (css.includes("@layer properties")) {
  violations.push("`@layer properties` block (Tailwind property registrations leak to the host page)");
}

if (/@property\s+--tw-/.test(css)) {
  violations.push("`@property --tw-*` registration (global custom-property registration)");
}

// Any :root/:host token not immediately preceded by a #fbjs scope on the same
// compound selector. We scan selector preludes only (text before `{`, split on `}`).
const selectorChunks = css.split("}").map((chunk) => chunk.slice(0, chunk.indexOf("{") + 1 || undefined));
const globalSelector = /(^|[,\s>+~(])(:root|:host)(?![\w-])/;
for (const chunk of selectorChunks) {
  const prelude = chunk.includes("{") ? chunk.slice(0, chunk.indexOf("{")) : "";
  if (!prelude) continue;
  for (const selector of prelude.split(",")) {
    if (globalSelector.test(selector) && !selector.includes("#fbjs")) {
      violations.push(`unscoped selector: \`${selector.trim().slice(0, 80)}\``);
    }
  }
}

if (violations.length > 0) {
  console.error("[assert-scoped-css] dist/survey-ui.css leaks global styles to the host page:");
  for (const violation of violations) console.error(`  - ${violation}`);
  console.error(
    "[assert-scoped-css] The postcss-scope-fbjs plugins no longer match Tailwind's output shape — update packages/vite-plugins/postcss-scope-fbjs.cjs."
  );
  process.exit(1);
}

console.log("[assert-scoped-css] dist/survey-ui.css is fully #fbjs-scoped ✔");
