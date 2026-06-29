import postcss from "postcss";
import { describe, expect, test } from "vitest";
import scopeFbjs from "./postcss-scope-fbjs.cjs";

// Regression guard for ENG-1333 / formbricks/js#46.
//
// survey-ui's and surveys' compiled CSS is injected into the host page's <head>
// by the survey widget. Tailwind v4 emits three constructs that are GLOBAL by
// spec and cannot be confined by the `important: "#fbjs"` selector scoping:
//   1. "@layer properties" with a bare `*, :before, :after, ::backdrop` reset
//   2. "@layer theme" with `:root, :host` custom properties
//   3. "@property --tw-*" registrations (inherits: false)
// If any reach the host page, they reset/override the host's own Tailwind
// custom properties and theme, breaking host UI (shadows, rings, transforms,
// gradients, colors).
//
// These tests run the shared scoping plugins over representative Tailwind v4
// output and assert nothing global survives.

const run = (css: string): string =>
  postcss(scopeFbjs.scopeFbjsPlugins()).process(css, { from: undefined }).css;

// A faithful slice of real Tailwind v4 compiled output.
const TAILWIND_V4_OUTPUT = `
@layer properties {
  @supports (((-webkit-hyphens: none)) and (not (margin-trim: inline))) {
    *, :before, :after, ::backdrop {
      --tw-translate-x: 0;
      --tw-border-style: solid;
      --tw-ring-offset-color: #fff;
    }
  }
}
@layer theme {
  :root, :host {
    --color-red-500: oklch(63.7% .237 25.331);
    --spacing: .25rem;
  }
}
@property --tw-translate-x {
  syntax: "*";
  inherits: false;
  initial-value: 0;
}
@property --tw-ring-offset-color {
  syntax: "<color>";
  inherits: false;
  initial-value: #fff;
}
#fbjs .flex {
  display: flex !important;
}
`;

describe("postcss-scope-fbjs", () => {
  const out = run(TAILWIND_V4_OUTPUT);
  const flat = out.replace(/\s+/g, " ");

  test("removes the global @layer properties reset block", () => {
    expect(out).not.toMatch(/@layer properties/);
    // the bare universal reset selector must not survive anywhere
    expect(out).not.toMatch(/(?:^|[^-\w])\*\s*,\s*:before/);
  });

  test("re-scopes @layer theme :root/:host to #fbjs", () => {
    expect(out).toMatch(/@layer theme/);
    // no bare :root / :host remain
    expect(out).not.toMatch(/(?:^|[^#\w-]):root\b/);
    expect(out).not.toMatch(/(?:^|[^#\w-]):host\b/);
    // theme variables now live under #fbjs
    expect(flat).toMatch(/#fbjs[^{]*\{[^}]*--color-red-500/);
  });

  test("replaces global @property --tw-* with a #fbjs-scoped rule", () => {
    expect(out).not.toMatch(/@property\s+--tw-/);
    // initial values re-emitted, scoped to #fbjs
    expect(flat).toMatch(/#fbjs[^{]*\{[^}]*--tw-translate-x: 0/);
    expect(flat).toMatch(/--tw-ring-offset-color: #fff/);
  });

  test("emits the --tw-* fallback inside the low-priority theme layer", () => {
    // The fallback must be layered so Tailwind's own utility/theme declarations
    // win over it; an unlayered rule would reset --tw-* set by survey utilities.
    expect(flat).toMatch(/@layer theme\s*\{[^}]*#fbjs[^}]*--tw-translate-x: 0/);
  });

  test("preserves utility classes already scoped to #fbjs", () => {
    expect(out).toMatch(/#fbjs \.flex/);
  });

  test("is a no-op when there is nothing global to scope", () => {
    const plain = "#fbjs .button { color: red; }";
    expect(run(plain).trim()).toBe(plain);
  });
});
