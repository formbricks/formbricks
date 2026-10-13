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

// Emits every `leading-<n>` the stylesheets map, whichever of them their components use today.
const LEADING_FIXTURE = '\n@source inline("leading-4 leading-5 leading-6");\n';

const compile = async (cssPath: string, configPath: string): Promise<postcss.Root> => {
  const plugins = await loadPlugins(configPath);
  const css = readFileSync(cssPath, "utf8") + LEADING_FIXTURE;
  const result = await postcss(plugins).process(css, { from: cssPath });
  return result.root;
};

const selectorOf = (decl: postcss.Declaration): string =>
  decl.parent?.type === "rule" ? (decl.parent as postcss.Rule).selector : "";

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
      found.push(`${selectorOf(decl)} { ${decl.prop}: ${decl.value} }`);
    }
  });
  return found;
};

// `leading-<n>` used to be n steps of `--spacing: .25em`, so the ratio that renders the same is n / 4.
// Returns each utility's line-height and --tw-leading next to that expected ratio.
const leadingValues = (root: postcss.Root): Record<string, { expected: number; values: number[] }> => {
  const found: Record<string, { expected: number; values: number[] }> = {};
  root.walkDecls(/^(line-height|--tw-leading)$/, (decl) => {
    const step = /\.leading-(\d+)(?![\w-])/.exec(selectorOf(decl))?.[1];
    if (!step) return;
    found[`leading-${step}`] ??= { expected: Number(step) / 4, values: [] };
    found[`leading-${step}`].values.push(Number(decl.value));
  });
  return found;
};

const SURVEYS = resolve(__dirname, "../..");
const SURVEY_UI = resolve(__dirname, "../../../survey-ui");

describe("renderer line heights stay unitless ratios", () => {
  test.each([
    ["surveys", resolve(SURVEYS, "src/styles/global.css"), resolve(SURVEYS, "postcss.config.cjs")],
    ["survey-ui", resolve(SURVEY_UI, "src/styles/globals.css"), resolve(SURVEY_UI, "postcss.config.mjs")],
  ])(
    "%s compiles leading-<n> to n / 4 and no length line-height",
    { timeout: 30_000 },
    async (_name, cssPath, configPath) => {
      const root = await compile(cssPath, configPath);
      const leading = leadingValues(root);

      expect(Object.keys(leading)).toEqual(expect.arrayContaining(["leading-4", "leading-5", "leading-6"]));
      for (const [utility, { expected, values }] of Object.entries(leading)) {
        expect(values, utility).toEqual([expected, expected]);
      }
      expect(lengthLineHeights(root)).toEqual([]);
    }
  );
});
