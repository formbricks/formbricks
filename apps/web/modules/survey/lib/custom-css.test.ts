import { describe, expect, test, vi } from "vitest";
import { compileCustomCss, recompileCustomCss } from "./custom-css";

vi.unmock("node:crypto");
vi.unmock("crypto");

const compile = (light: string, dark = "") => compileCustomCss({ light, dark }, "survey");

describe("custom CSS processing", () => {
  test("preserves source, rebases document roots and scopes every selector", () => {
    const source = "/* brand */ html body { --Brand: blue } .a, .b > button { color: var(--Brand) }";
    const { compiled, removed } = compile(source);
    expect(compiled?.light?.source).toBe(source);
    const variable = compiled?.light?.compiled.match(/(--fb-css-[a-f0-9]+):blue/)?.[1];
    expect(variable).toBeTruthy();
    expect(compiled?.light?.compiled).toContain(`color:var(${variable}) !important;`);
    expect(compiled?.light?.compiled).toContain("#fbjs .a,#fbjs  .b > button");
    expect(removed).toEqual([]);
  });

  test("makes light CSS shared and dark additions explicitly appearance scoped", () => {
    const { compiled } = compile(".a { color: black }", ".a { color: white }");
    expect(compiled?.light?.compiled).toContain("#fbjs .a");
    expect(compiled?.dark?.compiled).toContain('#fbjs[data-appearance="dark"] .a');
  });

  test.each([
    "background:url(https://evil.example)",
    String.raw`background:\75rl(https://evil.example)`,
    String.raw`--asset:u\72 l(https://evil.example)`,
    "background:image-set('https://evil.example/a.png' 1x)",
    "content:attr(value)",
    "position:fixed",
    "position:var(--position)",
    "--position:fixed",
    "behavior:foo",
    String.raw`-moz-\62inding:url(https://evil.example)`,
  ])("removes unsafe declaration %s and retains safe neighbors", (declaration) => {
    const { compiled, removed } = compile(`.a { ${declaration}; color: red }`);
    expect(compiled?.light?.compiled).toBe("#fbjs .a{color:red !important;}");
    expect(removed).toHaveLength(1);
  });

  test.each([
    "@import 'https://evil.example';",
    "@font-face{font-family:x;src:url(https://evil.example)}",
    "@property --x{syntax:'*';inherits:true;initial-value:red}",
    "@layer overrides {.a{color:red}}",
  ])("removes global at-rule %s", (source) => {
    const result = compile(source);
    expect(result.compiled?.light?.compiled).toBe("");
    expect(result.removed).toHaveLength(1);
  });

  test.each([
    "#fbjs + .outside",
    "#fbjs:hover ~ .outside",
    ":host",
    "body:has(.secret)",
    ":is(body,.a)",
    String.raw`#fb\6as + .outside`,
  ])("rejects escaping selector %s", (selector) => {
    const { compiled, removed } = compile(`${selector}{color:red}`);
    expect(compiled?.light?.compiled).toBe("");
    expect(removed).toHaveLength(1);
  });

  test("flattens supported nesting with media queries", () => {
    const { compiled, removed } = compile(
      ".a { color: red; &:hover { color:blue } @media (min-width: 400px) { & > button {color:green} } }"
    );
    expect(compiled?.light?.compiled).toContain("#fbjs .a:hover{color:blue !important;}");
    expect(compiled?.light?.compiled).toContain(
      "@media (min-width: 400px){#fbjs .a > button{color:green !important;}}"
    );
    expect(removed).toEqual([]);
  });

  test("prevents nested sibling rules escaping a rebased root", () => {
    const { compiled, removed } = compile("body { color:red; & + .outside {display:none} }");
    expect(compiled?.light?.compiled).toBe("#fbjs{color:red !important;}");
    expect(removed).toHaveLength(1);
  });

  test("namespaces keyframes and their animation references", () => {
    const { compiled } = compile(
      "@keyframes fade { from {opacity:0} to {opacity:1} } .a { animation: fade 1s }"
    );
    const name = compiled?.light?.compiled.match(/@keyframes ([^{]+)/)?.[1];
    expect(name).toMatch(/^fb-css-survey-/);
    expect(compiled?.light?.compiled).toContain(`animation:${name} 1s !important;`);
  });

  test("keeps theme tokens public while namespacing arbitrary fb-prefixed variables", () => {
    const { compiled } = compile(".a{color:var(--fb-brand-color);background:var(--fb-host-asset)}");
    expect(compiled?.light?.compiled).toContain("var(--fb-brand-color)");
    expect(compiled?.light?.compiled).not.toContain("--fb-host-asset");
  });

  test("rejects global backdrop styling", () => {
    const { removed, compiled } = compile("dialog::backdrop { background:red }");
    expect(compiled?.light?.compiled).toBe("");
    expect(removed).toHaveLength(1);
  });

  test("namespaces dark animation references to shared keyframes and preserves timing function keywords", () => {
    const { compiled } = compile(
      "@keyframes fade { from {opacity:0} to {opacity:1} }",
      ".a{animation:fade 1s steps(3, end)}"
    );
    const name = compiled?.light?.compiled.match(/@keyframes ([^{]+)/)?.[1];
    expect(compiled?.dark?.compiled).toContain(`animation:${name} 1s steps(3, end) !important;`);
  });

  test("keeps counters local rather than changing host document counters", () => {
    const { compiled, removed } = compile(
      ".a{counter-increment:page;content:counter(page)} .b{animation:var(--host-animation);all:inherit}"
    );
    expect(compiled?.light?.compiled).not.toContain("counter-increment:page");
    expect(compiled?.light?.compiled).not.toContain("counter(page)");
    expect(removed).toHaveLength(2);
  });

  test("dark keyframe definitions cannot override a light animation before dark mode is active", () => {
    const { compiled } = compile(
      "@keyframes fade {to{opacity:1}} .a{animation:fade 1s}",
      "@keyframes fade {to{opacity:.5}} .a{animation:fade 1s}"
    );
    const lightName = compiled?.light?.compiled.match(/@keyframes ([^{]+)/)?.[1];
    const darkName = compiled?.dark?.compiled.match(/@keyframes ([^{]+)/)?.[1];
    expect(lightName).not.toBe(darkName);
    expect(compiled?.light?.compiled).toContain(`animation:${lightName}`);
    expect(compiled?.dark?.compiled).toContain(`animation:${darkName}`);
  });

  test("blocks malformed syntax and aggregate UTF-8 size without changing source", () => {
    expect(() => compile(".a { color:red")).toThrow("CSS syntax error");
    expect(() => compile("/*" + "😀".repeat(6000) + "*/")).toThrow("20 KB");
    expect(() => compile("/*" + "a".repeat(12000) + "*/", "/*" + "a".repeat(12000) + "*/")).toThrow("20 KB");
  });

  test("blocks excessive declaration work and never accepts caller compiled content", () => {
    expect(() => compileCustomCss({ light: `.a{${"a:0;".repeat(5001)}}`, dark: "" }, "workspace")).toThrow(
      "too many"
    );
    expect(
      recompileCustomCss(
        {
          light: { source: ".a{color:red}", compiled: "body{display:none}" },
          dark: null,
          processorVersion: 900,
        },
        "survey"
      )?.light?.compiled
    ).toBe("#fbjs .a{color:red !important;}");
    expect(compile("").compiled).toBeNull();
  });
});
