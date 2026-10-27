import { describe, expect, test } from "vitest";
import { processCustomCss } from "./index";

/*
 * Synthetic fixtures with the shape of the CMS stylesheet this feature was designed around (ENG-3551):
 * invented token names and colors, never the customer's file. Same constructs: a Google Fonts @import,
 * design tokens on :root (one composite with var()), a font stack, body mixed into a selector list,
 * `.question *`, compound classes, an id, attribute selectors, :not(#id)/:hover/:active/:focus-visible,
 * a multi-shadow with inset, a display/visibility/height collapse, one declaration without !important,
 * and block comments including a commented-out rule.
 */

const PORTED = `/* Synthetic fixture: NOT the customer file. */
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap");

:root {
  --acme-brand: #1f5f8b;
  --acme-brand-dark: #174a6c;
  --acme-ink: #10283a;
  --acme-radius: 8px;
  --acme-font: "Inter", "Helvetica Neue", Arial, sans-serif;
  --acme-ring: 0 0 0 3px #ffffff, 0 0 4px 6px var(--acme-brand);
}

body, #fbjs [data-fb-part="input"] {
  font-family: var(--acme-font) !important;
}

[data-fb-part="headline"] { font-weight: 600 !important; font-size: 20px !important; color: var(--acme-ink) !important; }
[data-fb-part="option"]:has(:checked) [data-fb-part="option-control"] { border-color: var(--acme-brand) !important; }
[data-fb-part="input"]:focus-visible { outline: 2px solid transparent !important; box-shadow: var(--acme-ring) !important; }
[data-fb-part="button-primary"] {
  background: var(--acme-brand) !important;
  border-radius: 999px !important;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.2), 0 1px 2px rgba(16, 40, 58, 0.15) !important;
  transition: background-color 0.15s ease;
}
[data-fb-part="button-primary"]:hover:not(:disabled) { background: var(--acme-brand-dark) !important; }
[data-fb-part="button-back"]:not(#next-button):active { background: #e8f1f7 !important; }
[data-fb-part="error"] { background: #fbe5e6 !important; border: 1px solid #c30000 !important; border-radius: var(--acme-radius) !important; }
[data-fb-part="branding"] { display: none !important; visibility: hidden !important; height: 0 !important; }
/* .retired-rule { color: red !important; } */
`;

const DARK = `/* dark field */
:root { --acme-ink: #e6eef5; --acme-brand: #7ab8e0; }
`;

/** The same file before porting: Qualtrics-style selectors are accepted, scoped, and match nothing. */
const UNPORTED = `@import url("https://fonts.googleapis.com/css2?family=Inter&display=swap");
:root { --acme-ink: #10283a; }
body, .rich-text, .question *, input, button { font-family: "Inter", Arial, sans-serif !important; }
.question-display.rich-text { font-size: 20px !important; color: var(--acme-ink) !important; }
.question input[type="email"], .question input[type="text"] { border-radius: 8px !important; }
#next-button { border-radius: 999px !important; }
.navigation-button:not(#next-button):hover { background: #ffffff !important; }
.plug-container { display: none !important; }
`;

describe("CMS-style stylesheet", () => {
  test("removes only the @import, with its location, and keeps every other rule", () => {
    const result = processCustomCss({ scope: "workspace", input: { light: PORTED, dark: DARK } });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));

    expect(result.warnings).toEqual([
      {
        code: "import_removed",
        scope: "workspace",
        appearance: "light",
        line: 2,
        column: 1,
        reason: expect.any(String),
      },
    ]);

    const light = result.compiled.light!;
    expect(light.startsWith("@layer fb-workspace{")).toBe(true);
    expect(light).not.toMatch(/@import|fonts\.googleapis|retired-rule/);
    // Root aliases: the tokens and the body font land on the survey root.
    expect(light).toContain("#fbjs{--acme-brand:#1f5f8b!important;");
    expect(light).toContain("--acme-ring:0 0 0 3px #fff, 0 0 4px 6px var(--acme-brand)!important");
    expect(light).toContain('--acme-font:"Inter", "Helvetica Neue", Arial, sans-serif!important');
    expect(light).toContain("#fbjs,#fbjs [data-fb-part=input]{font-family:var(--acme-font)!important}");
    // Hooks, states and the declaration that was not important yet.
    expect(light).toContain("#fbjs [data-fb-part=option]:has(:checked) [data-fb-part=option-control]");
    expect(light).toContain("#fbjs [data-fb-part=button-back]:not(#next-button):active");
    expect(light).toContain("transition:background-color .15s!important");
    expect(light).toContain("box-shadow:inset 0 -1px #0003,0 1px 2px #10283a26!important");
    expect(light).toMatch(/#fbjs \[data-fb-part=branding\]\{[^}]*display:none!important/);

    // Dark tokens override only in dark mode.
    expect(result.compiled.dark).toBe(
      "@layer fb-workspace-dark{#fbjs[data-appearance=dark]{--acme-ink:#e6eef5!important;--acme-brand:#7ab8e0!important}}"
    );
  });

  test("accepts unported Qualtrics selectors, scoped, with the @import as the only change", () => {
    const result = processCustomCss({ scope: "survey", input: { light: UNPORTED, dark: null } });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.warnings.map((warning) => [warning.code, warning.line, warning.column])).toEqual([
      ["import_removed", 1, 1],
    ]);
    const light = result.compiled.light!;
    expect(light).toContain("#fbjs{--acme-ink:#10283a!important}");
    expect(light).toContain("#fbjs,#fbjs .rich-text,#fbjs .question *,#fbjs input,#fbjs button{");
    expect(light).toContain("#fbjs .question-display.rich-text{");
    expect(light).toContain("#fbjs .question input[type=email],#fbjs .question input[type=text]{");
    expect(light).toContain("#fbjs #next-button{border-radius:999px!important}");
    expect(light).toContain("#fbjs .navigation-button:not(#next-button):hover{");
    expect(light).toContain("#fbjs .plug-container{display:none!important}");
  });
});
