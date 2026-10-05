// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CUSTOM_CSS_LAYER_ORDER, CUSTOM_CSS_LAYER_PRELUDE } from "@formbricks/types/custom-css";

const nonce = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("@/lib/styles", () => ({ getStyleNonce: () => nonce.value }));

type TCustomCssModule = typeof import("./custom-css");

// The module keeps per-page state (current CSS, generation, warned diagnostics), so every test gets a
// fresh copy, as a fresh page would.
let customCss: TCustomCssModule;

const WORKSPACE_LIGHT = '@layer fb-workspace { #fbjs [data-fb-part="card"] { color: red !important } }';
const WORKSPACE_DARK =
  '@layer fb-workspace-dark { #fbjs[data-appearance="dark"] [data-fb-part="card"] { color: pink !important } }';
const SURVEY_LIGHT = '@layer fb-survey { #fbjs [data-fb-part="headline"] { color: blue !important } }';
const SURVEY_DARK =
  '@layer fb-survey-dark { #fbjs[data-appearance="dark"] [data-fb-part="headline"] { color: navy !important } }';

const getCustomStyle = () => document.getElementById("formbricks__custom-css");
const getPrelude = () => document.getElementById("formbricks__custom-css-layers");

beforeEach(async () => {
  vi.resetModules();
  nonce.value = undefined;
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  vi.spyOn(console, "warn").mockImplementation(() => {});
  customCss = await import("./custom-css");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildCustomCssText", () => {
  test("joins workspace then survey, light then dark, skipping absent and empty fields", () => {
    expect(
      customCss.buildCustomCssText({
        workspace: { light: WORKSPACE_LIGHT, dark: WORKSPACE_DARK },
        survey: { light: SURVEY_LIGHT, dark: SURVEY_DARK },
      })
    ).toBe([WORKSPACE_LIGHT, WORKSPACE_DARK, SURVEY_LIGHT, SURVEY_DARK].join("\n"));

    // One scope missing is a valid prop: that scope simply has no CSS (no workspace CSS saved, say).
    expect(customCss.buildCustomCssText({ survey: { light: SURVEY_LIGHT } })).toBe(SURVEY_LIGHT);
    expect(customCss.buildCustomCssText({ workspace: { dark: WORKSPACE_DARK }, survey: null })).toBe(
      WORKSPACE_DARK
    );
  });

  test("returns null when there is nothing to apply", () => {
    expect(customCss.buildCustomCssText(undefined)).toBeNull();
    expect(customCss.buildCustomCssText(null)).toBeNull();
    expect(customCss.buildCustomCssText({})).toBeNull();
    expect(customCss.buildCustomCssText({ workspace: {}, survey: { light: "  " } })).toBeNull();
  });

  test("rejects the whole prop when any scope is not compiled CSS — never half of it", () => {
    // A stored value passed by mistake carries the editable source; nothing of it may apply.
    const storedShape = {
      light: { source: ".a{}", compiled: SURVEY_LIGHT },
      dark: null,
      processorVersion: 1,
    };
    expect(
      customCss.buildCustomCssText({ workspace: { light: WORKSPACE_LIGHT }, survey: storedShape })
    ).toBeUndefined();
    expect(customCss.buildCustomCssText({ workspace: { light: 42 } })).toBeUndefined();
    expect(customCss.buildCustomCssText({ workspace: [WORKSPACE_LIGHT] })).toBeUndefined();
    expect(customCss.buildCustomCssText("@layer fb-survey {}")).toBeUndefined();
  });
});

describe("applyCustomCss", () => {
  test("writes one style element through textContent, so markup in CSS stays text", () => {
    const hostile = '@layer fb-survey { #fbjs .x { content: "</style><script>alert(1)</script>" } }';

    customCss.applyCustomCss({ survey: { light: hostile } });

    const style = getCustomStyle();
    expect(style?.tagName).toBe("STYLE");
    expect(style?.textContent).toBe(hostile);
    expect(style?.children).toHaveLength(0);
    expect(document.querySelectorAll("script")).toHaveLength(0);
    expect(document.querySelectorAll("#formbricks__custom-css")).toHaveLength(1);
  });

  test("puts the customer layer order first in <head>, ahead of layers the host declared", () => {
    const hostLayers = document.createElement("style");
    hostLayers.textContent = "@layer theme, base, components, utilities;";
    document.head.appendChild(hostLayers);

    customCss.applyCustomCss({ workspace: { light: WORKSPACE_LIGHT } });

    expect(document.head.firstChild).toBe(getPrelude());
    expect(getPrelude()?.textContent).toBe(
      "@layer fb-survey-dark, fb-survey, fb-workspace-dark, fb-workspace;"
    );

    // Something inserted in front later (a host script, a framework's stylesheet) is overtaken again on
    // the next render, and the prelude is never duplicated.
    const lateHostStyle = document.createElement("style");
    document.head.insertBefore(lateHostStyle, document.head.firstChild);
    customCss.applyCustomCss({ workspace: { light: WORKSPACE_LIGHT } });

    expect(document.head.firstChild).toBe(getPrelude());
    expect(document.querySelectorAll("#formbricks__custom-css-layers")).toHaveLength(1);
  });

  test("adds no element at all to a page whose surveys have no custom CSS", () => {
    customCss.applyCustomCss(undefined);
    customCss.applyCustomCss({ workspace: null, survey: {} });

    expect(getCustomStyle()).toBeNull();
    expect(getPrelude()).toBeNull();
  });

  test("replaces the previous survey's CSS and removes it for a survey without any", () => {
    customCss.applyCustomCss({ workspace: { light: WORKSPACE_LIGHT }, survey: { light: SURVEY_LIGHT } });
    customCss.applyCustomCss({ workspace: { light: WORKSPACE_LIGHT } });

    expect(document.querySelectorAll("#formbricks__custom-css")).toHaveLength(1);
    expect(getCustomStyle()?.textContent).toBe(WORKSPACE_LIGHT);

    customCss.applyCustomCss({});
    expect(getCustomStyle()).toBeNull();
  });

  test("carries the CSP nonce on both elements", () => {
    nonce.value = "abc123";

    customCss.applyCustomCss({ survey: { light: SURVEY_LIGHT } });

    expect(getCustomStyle()?.getAttribute("nonce")).toBe("abc123");
    expect(getPrelude()?.getAttribute("nonce")).toBe("abc123");
  });

  test("gives a nonce that arrives after the render to both elements", () => {
    customCss.applyCustomCss({ survey: { light: SURVEY_LIGHT } });
    expect(getCustomStyle()?.hasAttribute("nonce")).toBe(false);

    nonce.value = "late-nonce";
    customCss.syncCustomCssNonce();

    expect(getCustomStyle()?.getAttribute("nonce")).toBe("late-nonce");
    expect(getPrelude()?.getAttribute("nonce")).toBe("late-nonce");
    expect(getCustomStyle()?.textContent).toBe(SURVEY_LIGHT);
  });

  test("a malformed prop clears earlier CSS and records a diagnostic without the CSS", () => {
    customCss.applyCustomCss({ survey: { light: SURVEY_LIGHT } });
    customCss.applyCustomCss({ workspace: { light: WORKSPACE_LIGHT }, survey: { light: 1 } });
    customCss.applyCustomCss({ survey: "not compiled css" });

    expect(getCustomStyle()).toBeNull();
    expect(customCss.getCustomCssDiagnostics()).toEqual([{ code: "invalid_prop" }, { code: "invalid_prop" }]);
    // One console line per kind, so a re-rendering host is not flooded, and it never echoes the CSS.
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("fb-workspace");
  });

  test("an insertion that throws leaves no custom layer, and the render carries on", () => {
    customCss.applyCustomCss({ survey: { light: SURVEY_LIGHT } });
    const appendChild = vi.spyOn(document.head, "appendChild").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    // Forces a new element, which has to be appended.
    getCustomStyle()?.remove();

    expect(() => customCss.applyCustomCss({ workspace: { light: WORKSPACE_LIGHT } })).not.toThrow();

    appendChild.mockRestore();
    expect(getCustomStyle()).toBeNull();
    expect(customCss.getCustomCssDiagnostics()).toEqual([
      { code: "insertion_failed", errorName: "SecurityError" },
    ]);
  });

  test("a style the browser refused (no sheet, e.g. CSP) is removed, and applies once a nonce arrives", () => {
    const sheet = Object.getOwnPropertyDescriptor(HTMLStyleElement.prototype, "sheet");
    Object.defineProperty(HTMLStyleElement.prototype, "sheet", { configurable: true, get: () => null });

    try {
      customCss.applyCustomCss({ survey: { light: SURVEY_LIGHT } });
      expect(getCustomStyle()).toBeNull();
      expect(customCss.getCustomCssDiagnostics()).toEqual([{ code: "blocked" }]);
    } finally {
      if (sheet) Object.defineProperty(HTMLStyleElement.prototype, "sheet", sheet);
      else delete (HTMLStyleElement.prototype as { sheet?: unknown }).sheet;
    }

    nonce.value = "now-allowed";
    customCss.syncCustomCssNonce();

    expect(getCustomStyle()?.textContent).toBe(SURVEY_LIGHT);
    expect(getCustomStyle()?.getAttribute("nonce")).toBe("now-allowed");
  });
});

describe("releaseCustomCss", () => {
  test("removes the CSS of the survey that closes", () => {
    customCss.applyCustomCss({ survey: { light: SURVEY_LIGHT } });
    customCss.releaseCustomCss(customCss.getCustomCssGeneration());

    expect(getCustomStyle()).toBeNull();
    // Nothing left to re-apply when a nonce arrives afterwards.
    nonce.value = "after-close";
    customCss.syncCustomCssNonce();
    expect(getCustomStyle()).toBeNull();
  });

  test("a survey closing after the next one rendered leaves the next one's CSS alone", () => {
    customCss.applyCustomCss({ survey: { light: SURVEY_LIGHT } });
    const firstSurvey = customCss.getCustomCssGeneration();
    customCss.applyCustomCss({ survey: { light: SURVEY_DARK } });

    customCss.releaseCustomCss(firstSurvey);

    expect(getCustomStyle()?.textContent).toBe(SURVEY_DARK);
  });
});

describe("layer order", () => {
  test("the head prelude is exactly the customer layers, in M2.03 order, ahead of the built-in ones", () => {
    const customerLayers = CUSTOM_CSS_LAYER_ORDER.filter((layer) => layer.startsWith("fb-"));

    expect(customerLayers).toEqual(["fb-survey-dark", "fb-survey", "fb-workspace-dark", "fb-workspace"]);
    // Strongest-first for !important: every customer layer precedes every built-in layer.
    expect(CUSTOM_CSS_LAYER_ORDER.slice(0, customerLayers.length)).toEqual(customerLayers);
    expect(customCss.CUSTOM_CSS_HEAD_PRELUDE).toBe(`@layer ${customerLayers.join(", ")};`);
  });

  test.each([
    ["surveys", "../styles/global.css"],
    ["survey-ui", "../../../survey-ui/src/styles/globals.css"],
  ])("the %s stylesheet opens with the full prelude, before it registers any layer", (_, path) => {
    const css = readFileSync(resolve(__dirname, path), "utf8");
    const firstLayerStatement = /@layer[^;{]*[;{]/.exec(css)?.[0];

    expect(firstLayerStatement).toBe(CUSTOM_CSS_LAYER_PRELUDE);
  });
});
