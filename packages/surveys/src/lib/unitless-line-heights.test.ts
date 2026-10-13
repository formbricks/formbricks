import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import postcss, { type AcceptedPlugin } from "postcss";
import { describe, expect, test } from "vitest";

// Regression guard for ENG-3427. iPhone WebKit scales a length line-height twice under the iOS SDK's
// `-webkit-text-size-adjust` (Dynamic Type): an em resolves against the already enlarged font size,
// and then the length is enlarged again. A unitless ratio scales once. Tailwind's `leading-<n>` falls
// back to `calc(var(--spacing) * n)`, an em length once rem→em runs, unless `@theme` gives `--leading-<n>`
// a ratio, so a new `leading-<n>` without one reintroduces the bug on iPhone only.

const loadPlugins = async (configPath: string): Promise<AcceptedPlugin[]> => {
  const config = (await import(pathToFileURL(configPath).href)) as {
    default: { plugins: AcceptedPlugin[] };
  };
  return config.default.plugins;
};

const compile = async (cssPath: string, configPath: string): Promise<postcss.Root> => {
  const plugins = await loadPlugins(configPath);
  const result = await postcss(plugins).process(readFileSync(cssPath, "utf8"), { from: cssPath });
  return result.root;
};

const isLineHeight = (prop: string): boolean =>
  prop === "line-height" || prop === "--tw-leading" || /^--leading-|^--text-.+--line-height$/.test(prop);

// A number followed by a unit (em, rem, px, %, …) or the spacing scale, which is a length. Custom
// property names are dropped first so `var(--text-2xl--line-height)` does not read as "2xl".
const hasLength = (value: string): boolean =>
  value.includes("var(--spacing)") || /\d(?:[a-z]+|%)/i.test(value.replaceAll(/--[\w-]+/g, ""));

const lengthLineHeights = (root: postcss.Root): string[] => {
  const found: string[] = [];
  root.walkDecls((decl) => {
    if (isLineHeight(decl.prop) && hasLength(decl.value)) {
      const selector = decl.parent?.type === "rule" ? (decl.parent as postcss.Rule).selector : "";
      found.push(`${selector} { ${decl.prop}: ${decl.value} }`);
    }
  });
  return found;
};

const SURVEYS = resolve(__dirname, "../..");
const SURVEY_UI = resolve(__dirname, "../../../survey-ui");

describe("renderer line heights stay unitless", () => {
  test.each([
    ["surveys", resolve(SURVEYS, "src/styles/global.css"), resolve(SURVEYS, "postcss.config.cjs")],
    ["survey-ui", resolve(SURVEY_UI, "src/styles/globals.css"), resolve(SURVEY_UI, "postcss.config.mjs")],
  ])("%s compiles no length line-height", { timeout: 30_000 }, async (_name, cssPath, configPath) => {
    const root = await compile(cssPath, configPath);

    // The compile really produced the utilities under test, so an empty result cannot pass.
    expect(root.toString()).toContain(".leading-6");
    expect(lengthLineHeights(root)).toEqual([]);
  });
});
