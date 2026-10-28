import { describe, expect, test } from "vitest";
import { DEFAULT_CREATIVE_STYLE } from "../../shared/creatives-renderer";
import {
  buildCreativeView,
  getLanguageOptions,
  isCreativeStyle,
  readCreativePreview,
  readFailure,
} from "./model";
import { asStructured, makeBanner, makeFeedbackButton } from "./test-creatives";

describe("readCreativePreview", () => {
  test("reads the creative, its resolved style and the trigger names", () => {
    const creative = makeFeedbackButton();
    const style = { ...DEFAULT_CREATIVE_STYLE, pageFont: true };

    const preview = readCreativePreview({
      structuredContent: asStructured(creative),
      _meta: { formbricks: { style, styleIsExact: true, triggerNames: ["Exit intent"] } },
    });

    expect(preview).toEqual({ creative, style, styleIsExact: true, triggerNames: ["Exit intent"] });
  });

  test("falls back to the neutral style and says so when the server sent none", () => {
    const preview = readCreativePreview({ structuredContent: asStructured(makeBanner()) });

    expect(preview?.style).toBe(DEFAULT_CREATIVE_STYLE);
    expect(preview?.styleIsExact).toBe(false);
    expect(preview?.triggerNames).toBeNull();
  });

  test("keeps a resolved style but reports it as approximate when the server says so", () => {
    const preview = readCreativePreview({
      structuredContent: asStructured(makeBanner()),
      _meta: { formbricks: { style: DEFAULT_CREATIVE_STYLE, styleIsExact: false } },
    });

    expect(preview?.style).toBe(DEFAULT_CREATIVE_STYLE);
    expect(preview?.styleIsExact).toBe(false);
  });

  test.each([
    ["no result", undefined],
    ["an error result", { structuredContent: { error: { status: 403 } } }],
    ["a creative of an unknown type", { structuredContent: { data: { ...makeBanner(), type: "popup" } } }],
    ["a creative without content", { structuredContent: { data: { ...makeBanner(), content: null } } }],
    [
      "an unknown display status",
      { structuredContent: { data: { ...makeBanner(), displayStatus: "gone" } } },
    ],
  ])("is not a creative: %s", (_name, result) => {
    expect(readCreativePreview(result)).toBeUndefined();
  });

  test("ignores trigger names that are not all strings", () => {
    const preview = readCreativePreview({
      structuredContent: asStructured(makeBanner()),
      _meta: { formbricks: { triggerNames: ["ok", 2] } },
    });

    expect(preview?.triggerNames).toBeNull();
  });
});

describe("isCreativeStyle", () => {
  test("needs a styled element and the page font flag", () => {
    expect(isCreativeStyle(DEFAULT_CREATIVE_STYLE)).toBe(true);
    expect(isCreativeStyle({ ...DEFAULT_CREATIVE_STYLE, pageFont: "yes" })).toBe(false);
    expect(isCreativeStyle({ ...DEFAULT_CREATIVE_STYLE, element: {} })).toBe(false);
    expect(isCreativeStyle(null)).toBe(false);
  });
});

describe("readFailure", () => {
  test("reads error.detail from a failed Formbricks tool result", () => {
    expect(
      readFailure({ isError: true, structuredContent: { error: { detail: "You are not authorized" } } })
    ).toBe("You are not authorized");
  });

  test("falls back to the result text and is empty for a success", () => {
    expect(readFailure({ isError: true, content: [{ type: "text", text: "boom" }] })).toBe("boom");
    expect(readFailure({ structuredContent: { data: {} } })).toBeUndefined();
  });
});

describe("getLanguageOptions", () => {
  test("lists the default first and leaves out disabled languages", () => {
    const creative = makeFeedbackButton({
      languages: [
        { code: "de-DE", default: false, enabled: true },
        { code: "fr-FR", default: false, enabled: false },
        { code: "en-US", default: true, enabled: true },
      ],
    });

    expect(getLanguageOptions(creative).map(({ code }) => code)).toEqual(["en-US", "de-DE"]);
  });
});

describe("buildCreativeView", () => {
  const style = DEFAULT_CREATIVE_STYLE;

  test("picks a feedback button's label in the chosen language", () => {
    const creative = makeFeedbackButton({
      languages: [
        { code: "en-US", default: true, enabled: true },
        { code: "de-DE", default: false, enabled: true },
      ],
    });

    expect(buildCreativeView(creative, style, "de-DE")).toMatchObject({
      type: "feedbackButton",
      label: "Rückmeldung",
    });
  });

  test("falls back to the default language for a missing translation or a disabled language", () => {
    const creative = makeFeedbackButton({
      content: { label: { "en-US": "Feedback", "de-DE": "  " }, icon: null },
      languages: [
        { code: "en-US", default: true, enabled: true },
        { code: "de-DE", default: false, enabled: true },
        { code: "fr-FR", default: false, enabled: false },
      ],
    });

    expect(buildCreativeView(creative, style, "de-DE")).toMatchObject({ label: "Feedback" });
    expect(buildCreativeView(creative, style, "fr-FR")).toMatchObject({ label: "Feedback" });
  });

  test("a feedback button without a destination still previews", () => {
    expect(buildCreativeView(makeFeedbackButton(), style, "en-US")).toMatchObject({
      type: "feedbackButton",
      destination: { type: "link" },
    });
  });

  test("maps a banner's message, button and dismiss control", () => {
    const view = buildCreativeView(makeBanner(), style, "en-US");

    expect(view).toMatchObject({
      type: "banner",
      message: [{ text: "Hello", bold: true }],
      buttonLabel: "Go",
      dismissible: true,
      accessibleName: null,
      destination: null,
    });
  });

  test("a banner without a button has no button label", () => {
    const banner = makeBanner();
    banner.content.button = null;

    expect(buildCreativeView(banner, style, "en-US")).toMatchObject({ buttonLabel: null });
  });

  test("a survey popup destination is kept, a link or newTab survey is only a stand-in", () => {
    const popup = makeFeedbackButton({
      destination: { type: "survey", surveyId: "s1", surveyName: "S", opensAs: "popup" },
    });
    const link = makeFeedbackButton({
      destination: { type: "link", url: "https://example.com", opensAs: "newTab" },
    });

    expect(buildCreativeView(popup, style, "en-US")).toMatchObject({
      destination: { type: "survey", surveyId: "s1", opensAs: "popup" },
    });
    expect(buildCreativeView(link, style, "en-US")).toMatchObject({ destination: { type: "link" } });
  });
});
