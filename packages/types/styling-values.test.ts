import { describe, expect, test } from "vitest";
import { ZBaseStyling, ZLogo, ZSurveyStylingBackground } from "./styling";
import {
  isSafeThemeBackground,
  isSafeThemeBoxShadow,
  isSafeThemeColor,
  isSafeThemeDimension,
  isSafeThemeFontFamily,
  isSafeThemeFontWeight,
  sanitizeThemeStyling,
} from "./styling-values";

/** Values that try to add declarations, rules, comments, resources or break out of a <style> element. */
const INJECTIONS = [
  "8px; background: url(https://evil.example/x)",
  "8px } body { display: none",
  "8px { color: red }",
  "8px !important",
  "red</style><script>alert(1)</script>",
  "url(https://evil.example/x)",
  "expression(alert(1))",
  "attr(data-x)",
  "8px /* comment */",
  String.raw`8px\3b color: red`,
  "8px\ncolor: red",
  "var(--x); color: red",
  "calc(1px); color: red",
  "image-set('a.png' 1x)",
  '"unterminated',
  "@import 'x.css'",
  "rgb(0 0 0); x: y",
  "",
  "   ",
];

describe("theme value grammars reject anything that could add CSS", () => {
  test.each(INJECTIONS)("%j", (value) => {
    expect(isSafeThemeDimension(value)).toBe(false);
    expect(isSafeThemeFontWeight(value)).toBe(false);
    expect(isSafeThemeColor(value)).toBe(false);
    expect(isSafeThemeBoxShadow(value)).toBe(false);
    expect(isSafeThemeFontFamily(value)).toBe(false);
  });
});

describe("isSafeThemeDimension", () => {
  test.each([
    8,
    0,
    12.5,
    -1,
    "8",
    "12.5",
    "8px",
    "1.25rem",
    "100%",
    "1em",
    "2.75rem",
    "auto",
    "1e3px",
    "0 4px",
    "8px 4px 2px 1px",
    "calc(100% - 2 * 4px)",
    "min(10px, 2vh)",
    "clamp(1rem, 2vw, 3rem)",
    "var(--fb-border-radius)",
    "var(--x, 8px)",
    "inherit",
  ])("accepts %j", (value) => expect(isSafeThemeDimension(value)).toBe(true));
  test.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "8 px",
    "8px8px",
    "1px 2px 3px 4px 5px",
    "red",
    "calc(1px",
    "8kg ",
    "url(x)",
    "var(x)",
    "-",
    null,
    {},
  ])("rejects %j", (value) => expect(isSafeThemeDimension(value)).toBe(false));
});

describe("isSafeThemeFontWeight", () => {
  test.each([100, 400, 900, 1000, "500", "600", "bold", "normal", "lighter", "inherit"])(
    "accepts %j",
    (value) => expect(isSafeThemeFontWeight(value)).toBe(true)
  );
  test.each([0, 1001, -1, "0", "500px", "heavy", "bold bold", "500;"])("rejects %j", (value) =>
    expect(isSafeThemeFontWeight(value)).toBe(false)
  );
});

describe("isSafeThemeColor", () => {
  test.each([
    "#fff",
    "#FFF8",
    "#64748b",
    "#64748B80",
    "red",
    "transparent",
    "currentColor",
    "rgb(0 0 0 / 0.05)",
    "rgba(16, 40, 58, 0.25)",
    "hsl(210deg 40% 50%)",
    "oklch(0.7 0.1 200)",
    "color-mix(in srgb, #fff 50%, black)",
    "var(--brand)",
  ])("accepts %j", (value) => expect(isSafeThemeColor(value)).toBe(true));
  test.each(["#ff", "#fffff", "#ggg", "notacolor", "rgb(0 0 0) red", "url(x)", "rgb(url(x))", 0x123456])(
    "rejects %j",
    (value) => expect(isSafeThemeColor(value)).toBe(false)
  );
});

describe("isSafeThemeBoxShadow", () => {
  test.each([
    "none",
    "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    "inset 0 0 0 1px rgba(16, 40, 58, 0.25), 0 1px 2px #0000000d",
    "0 0 0 3px var(--ring)",
    "2px 2px",
    "red 1px 1px 2px",
  ])("accepts %j", (value) => expect(isSafeThemeBoxShadow(value)).toBe(true));
  test.each([
    "1px",
    "inset inset 1px 1px",
    "1px 1px red blue",
    "0 0 0 0 0 red",
    "1px 1px,",
    ", 1px 1px",
    "1px 1px url(x)",
  ])("rejects %j", (value) => expect(isSafeThemeBoxShadow(value)).toBe(false));
});

describe("isSafeThemeFontFamily", () => {
  test.each([
    "Inter",
    '"Inter", Arial, sans-serif',
    "'Open Sans', 'Helvetica Neue', Helvetica, system-ui",
    "Open Sans",
    '"Noto Sans JP", "游ゴシック", sans-serif',
  ])("accepts %j", (value) => expect(isSafeThemeFontFamily(value)).toBe(true));
  test.each(['"Inter', "Inter,", '"a"b', "Font 2", "var(--font)", '"</style>"', '"a;b"', "'it''s'"])(
    "rejects %j",
    (value) => expect(isSafeThemeFontFamily(value)).toBe(false)
  );
});

describe("isSafeThemeBackground", () => {
  test("requires a color only for solid backgrounds", () => {
    expect(isSafeThemeBackground({ bg: "#f1f5f9", bgType: "color" })).toBe(true);
    expect(isSafeThemeBackground({ bg: "red;background-image:url(x)", bgType: "color" })).toBe(false);
    expect(isSafeThemeBackground({ bg: "https://images.example/a.jpg", bgType: "image" })).toBe(true);
    expect(isSafeThemeBackground({ bg: "/animated-bgs/4K/1_4k.mp4", bgType: "animation" })).toBe(true);
    expect(isSafeThemeBackground({ bg: null, bgType: "color" })).toBe(true);
  });
});

describe("styling schemas validate on write", () => {
  test("accept the default theme and a typical styled theme", () => {
    expect(ZBaseStyling.safeParse(DEFAULT_STYLING).success).toBe(true);
    expect(ZBaseStyling.safeParse(TYPICAL_STYLING).success).toBe(true);
  });

  test.each([
    ["inputShadow", "0 0 red; background: url(https://evil.example/x)"],
    ["fontFamily", "Arial; background: url(https://evil.example/x)"],
    ["roundness", "8px } body { display: none"],
    ["buttonHeight", "1px; position: fixed"],
    ["elementHeadlineFontWeight", "600; color: red"],
    ["progressTrackHeight", "8px</style>"],
  ])("reject an unsafe %s", (field, value) => {
    const result = ZBaseStyling.safeParse({ [field]: value });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual([field]);
  });

  test("reject an unsafe logo background and solid survey background", () => {
    expect(ZLogo.safeParse({ bgColor: "#fff;background:url(x)" }).success).toBe(false);
    expect(ZLogo.safeParse({ bgColor: "#ffffff" }).success).toBe(true);
    expect(ZSurveyStylingBackground.safeParse({ bg: "red;x:y", bgType: "color" }).success).toBe(false);
    expect(ZSurveyStylingBackground.safeParse({ bg: "#fff", bgType: "color" }).success).toBe(true);
  });
});

describe("sanitizeThemeStyling", () => {
  test("returns valid styling unchanged, value for value", () => {
    expect(sanitizeThemeStyling(DEFAULT_STYLING)).toEqual(DEFAULT_STYLING);
    expect(sanitizeThemeStyling(TYPICAL_STYLING)).toEqual(TYPICAL_STYLING);
  });

  test("drops unsafe legacy values so the normal fallback applies", () => {
    const sanitized = sanitizeThemeStyling({
      ...TYPICAL_STYLING,
      inputShadow: "0 0 red; background: url(https://evil.example/x)",
      roundness: "8px } body { display: none",
      buttonFontWeight: "600;x:y",
      fontFamily: "Arial; x: y",
      inputPlaceholderOpacity: Number.NaN,
      brandColor: { light: "red;x:y", dark: "#000" },
      cardBackgroundColor: { light: "#fff", dark: "#000;x:y" },
      logo: { url: "https://example.com/logo.png", bgColor: "#fff;x:y" },
      background: { bg: "red;x:y", bgType: "color" as const, brightness: 100 },
    });
    expect(sanitized.inputShadow).toBeUndefined();
    expect(sanitized.roundness).toBeUndefined();
    expect(sanitized.buttonFontWeight).toBeUndefined();
    expect(sanitized.fontFamily).toBeUndefined();
    expect(sanitized.inputPlaceholderOpacity).toBeUndefined();
    expect(sanitized.brandColor).toBeUndefined();
    expect(sanitized.cardBackgroundColor).toEqual({ light: "#fff", dark: null });
    expect(sanitized.logo).toEqual({ url: "https://example.com/logo.png", bgColor: undefined });
    expect(sanitized.background).toEqual({ bg: undefined, bgType: "color", brightness: 100 });
    // Untouched where valid.
    expect(sanitized.buttonBorderRadius).toBe(TYPICAL_STYLING.buttonBorderRadius);
  });

  test("leaves null (explicitly unset) values alone", () => {
    expect(sanitizeThemeStyling({ roundness: null, inputShadow: null, brandColor: null })).toEqual({
      roundness: null,
      inputShadow: null,
      brandColor: null,
    });
  });
});

/** The workspace default theme (apps/web STYLE_DEFAULTS, copied so this package stays dependency-free). */
const DEFAULT_STYLING = {
  brandColor: { light: "#64748b" },
  inputBorderColor: { light: "#cbd5e1" },
  cardBackgroundColor: { light: "#ffffff" },
  cardBorderColor: { light: "#f8fafc" },
  isLogoHidden: false,
  highlightBorderColor: { light: "#64748b" },
  roundness: 8,
  cardArrangement: { linkSurveys: "cardless" as const, appSurveys: "simple" as const },
  linkSurveyCardWidth: "default" as const,
  elementHeadlineColor: { light: "#0f172a" },
  elementHeadlineFontSize: 16,
  elementHeadlineFontWeight: 500,
  elementDescriptionColor: { light: "#334155" },
  elementDescriptionFontSize: 14,
  elementDescriptionFontWeight: 400,
  elementUpperLabelColor: { light: "#64748b" },
  elementUpperLabelFontSize: 12,
  elementUpperLabelFontWeight: 400,
  inputBgColor: { light: "#f8fafc" },
  inputTextColor: { light: "#0f172a" },
  inputBorderRadius: 8,
  inputHeight: 20,
  inputFontSize: 14,
  inputPaddingX: 8,
  inputPaddingY: 8,
  inputPlaceholderOpacity: 0.5,
  inputShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  buttonBgColor: { light: "#0f172a" },
  buttonTextColor: { light: "#ffffff" },
  buttonBorderRadius: 8,
  buttonHeight: "auto",
  buttonFontSize: 16,
  buttonFontWeight: 500,
  buttonPaddingX: 12,
  buttonPaddingY: 12,
  optionBgColor: { light: "#f8fafc" },
  optionLabelColor: { light: "#0f172a" },
  optionBorderColor: { light: "#cbd5e1" },
  optionBorderRadius: 8,
  optionPaddingX: 16,
  optionPaddingY: 16,
  optionFontSize: 14,
  progressTrackHeight: 8,
  progressTrackBgColor: { light: "#e2e8f0" },
  progressIndicatorBgColor: { light: "#64748b" },
};

/** A typical customized theme: string sizes in several units, keyword weights, dark overrides, a logo. */
const TYPICAL_STYLING = {
  brandColor: { light: "#1F5F8B", dark: "#7AB8E0" },
  accentBgColor: { light: "#e8f1f7" },
  cardBackgroundColor: { light: "#FFFFFF", dark: "#0c181e" },
  inputBorderColor: { light: "#8a9aa8", dark: null },
  inputBgColor: { light: "#fff" },
  elementHeadlineColor: { light: "#10283a", dark: "#e6eef5" },
  roundness: "12",
  fontFamily: '"Inter", Arial, sans-serif',
  buttonBorderRadius: "999px",
  buttonHeight: "2.75rem",
  buttonFontSize: "1rem",
  buttonFontWeight: "600",
  buttonPaddingX: 24,
  buttonPaddingY: "10",
  inputBorderRadius: "0.5rem",
  inputHeight: 44,
  inputFontSize: "100%",
  inputPaddingX: "12px",
  inputPaddingY: 12.5,
  inputPlaceholderOpacity: 0.6,
  inputShadow: "inset 0 0 0 1px rgba(16, 40, 58, 0.25), 0 1px 2px #0000000d",
  optionBorderRadius: "8px",
  optionPaddingX: "1em",
  elementHeadlineFontSize: "1.25rem",
  elementHeadlineFontWeight: 600,
  elementDescriptionFontWeight: "normal",
  elementUpperLabelFontSize: "0.75rem",
  elementUpperLabelFontWeight: "bold",
  progressTrackHeight: "6",
  background: { bg: "#f1f5f9", bgType: "color" as const, brightness: 100 },
  logo: { url: "https://example.com/logo.png", bgColor: "#ffffff" },
};
