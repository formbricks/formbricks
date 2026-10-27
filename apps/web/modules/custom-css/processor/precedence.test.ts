import { describe, expect, test } from "vitest";
import { CUSTOM_CSS_LAYER_ORDER, CUSTOM_CSS_LAYER_PRELUDE } from "@formbricks/types/custom-css";
import { processCustomCss } from "./index";

/*
 * M2.03 precedence, asserted on the compiled structure: customer declarations are `!important`, scoped to
 * #fbjs, inside the scope's layer, and the layer prelude lists customer layers before the built-in ones.
 * For important declarations the layer listed first wins and any layer beats unlayered CSS, which is what
 * makes these beat Tailwind's important utilities, the theme editor's unlayered `!important` rules and a
 * hostile host page. jsdom/happy-dom do not implement cascade layers, so the computed-style outcome was
 * checked in Chromium (same five cases and four dark-order rows) rather than here.
 */

const compile = (scope: "workspace" | "survey", light: string | null, dark: string | null) => {
  const result = processCustomCss({ scope, input: { light, dark } });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  expect(result.warnings).toEqual([]);
  return result.compiled;
};

/** Every declaration in a compiled block, as `property:value!important` strings. */
const declarationsOf = (css: string) => [...css.matchAll(/[{;]([-a-z]+:[^;{}]+)/g)].map((match) => match[1]);

describe("M2.03 override cases", () => {
  test.each([
    [
      '[data-fb-part="headline"] { font-size: 31px }',
      "#fbjs [data-fb-part=headline]{font-size:31px!important}",
    ],
    [
      '[data-fb-part="button-primary"] { border-color: red; box-shadow: none }',
      "#fbjs [data-fb-part=button-primary]{box-shadow:none!important;border-color:red!important}",
    ],
    [
      '[data-fb-part="option"] { background-color: green }',
      "#fbjs [data-fb-part=option]{background-color:green!important}",
    ],
    [
      '[data-fb-part="option"] { border-radius: 0 }',
      "#fbjs [data-fb-part=option]{border-radius:0!important}",
    ],
    // The original M2.03 cases, written against internal classes, keep working the same way.
    [".label-headline { font-size: 31px }", "#fbjs .label-headline{font-size:31px!important}"],
    [
      ".button-custom { border-color: red; box-shadow: none }",
      "#fbjs .button-custom{box-shadow:none!important;border-color:red!important}",
    ],
    [".bg-option-bg { background-color: green }", "#fbjs .bg-option-bg{background-color:green!important}"],
    [".rounded-option { border-radius: 0 }", "#fbjs .rounded-option{border-radius:0!important}"],
  ])("%s", (source, expected) => {
    expect(compile("survey", source, null).light).toBe(`@layer fb-survey{${expected}}`);
  });

  test("rules inside @media and @supports stay in the layer and stay important", () => {
    const { light } = compile(
      "survey",
      '@media (max-width: 640px) { [data-fb-part="headline"] { font-size: 24px } }\n@supports (display: grid) { [data-fb-part="card"] { gap: 8px } }',
      null
    );
    expect(light).toBe(
      "@layer fb-survey{@media (max-width:640px){#fbjs [data-fb-part=headline]{font-size:24px!important}}@supports (display:grid){#fbjs [data-fb-part=card]{gap:8px!important}}}"
    );
  });

  test("customer layers come before the theme and built-in layers in the prelude", () => {
    const position = (layer: string) => CUSTOM_CSS_LAYER_ORDER.indexOf(layer as never);
    expect(
      CUSTOM_CSS_LAYER_PRELUDE.startsWith(
        "@layer fb-survey-dark, fb-survey, fb-workspace-dark, fb-workspace,"
      )
    ).toBe(true);
    for (const builtIn of ["theme", "base", "components", "utilities"]) {
      expect(position("fb-workspace")).toBeLessThan(position(builtIn));
    }
  });
});

describe("M2.03 dark order", () => {
  const workspace = compile(
    "workspace",
    '[data-fb-part="headline"] { color: #111 }',
    '[data-fb-part="headline"] { color: #222 }'
  );
  const survey = compile(
    "survey",
    '[data-fb-part="headline"] { color: #333 }',
    '[data-fb-part="headline"] { color: #444 }'
  );

  test("each field compiles into its own layer, dark fields only under the dark root", () => {
    expect(workspace.light).toBe("@layer fb-workspace{#fbjs [data-fb-part=headline]{color:#111!important}}");
    expect(workspace.dark).toBe(
      "@layer fb-workspace-dark{#fbjs[data-appearance=dark] [data-fb-part=headline]{color:#222!important}}"
    );
    expect(survey.light).toBe("@layer fb-survey{#fbjs [data-fb-part=headline]{color:#333!important}}");
    expect(survey.dark).toBe(
      "@layer fb-survey-dark{#fbjs[data-appearance=dark] [data-fb-part=headline]{color:#444!important}}"
    );
  });

  /**
   * The winner among matching important declarations is the one in the layer listed first. Light mode
   * matches only the base layers; dark mode matches all four.
   */
  const winner = (appearance: "light" | "dark", compiled: Array<string | null>) => {
    const candidates = compiled
      .filter((css): css is string => css !== null)
      .filter((css) => appearance === "dark" || !css.includes("[data-appearance=dark]"))
      .map((css) => ({ layer: /^@layer ([-a-z]+)\{/.exec(css)![1], value: declarationsOf(css)[0] }));
    candidates.sort(
      (a, b) =>
        CUSTOM_CSS_LAYER_ORDER.indexOf(a.layer as never) - CUSTOM_CSS_LAYER_ORDER.indexOf(b.layer as never)
    );
    return candidates[0]?.value;
  };

  test.each([
    ["light mode", "light", "all", "color:#333!important"],
    ["dark mode, all four set", "dark", "all", "color:#444!important"],
    ["dark mode, no survey dark CSS", "dark", "no-survey-dark", "color:#333!important"],
    ["dark mode, only workspace CSS", "dark", "workspace-only", "color:#222!important"],
  ] as const)("%s", (_, appearance, setup, expected) => {
    const fields = {
      all: [workspace.light, workspace.dark, survey.light, survey.dark],
      "no-survey-dark": [workspace.light, workspace.dark, survey.light],
      "workspace-only": [workspace.light, workspace.dark],
    }[setup];
    expect(winner(appearance, fields)).toBe(expected);
  });
});
