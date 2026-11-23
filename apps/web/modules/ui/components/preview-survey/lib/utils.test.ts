// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, test } from "vitest";
import type { TSurveyStyling } from "@formbricks/types/surveys/types";
import {
  getFullScreenPreviewStyles,
  getModalBackground,
  getPlacementStyle,
  getPreviewPageUrl,
  getSlidingAnimationClass,
  isInsideSurveyRoot,
  mirrorPlacementForDir,
  resolvePreviewLanguageCode,
  resolvePreviewType,
} from "./utils";

describe("getPlacementStyle", () => {
  test("returns correct style for bottomRight placement", () => {
    const style = getPlacementStyle("bottomRight");
    expect(style).toBe("bottom-3 sm:right-3");
  });

  test("returns correct style for topRight placement", () => {
    const style = getPlacementStyle("topRight");
    expect(style).toBe("sm:top-6 sm:right-6");
  });

  test("returns correct style for topLeft placement", () => {
    const style = getPlacementStyle("topLeft");
    expect(style).toBe("sm:top-6 sm:left-6");
  });

  test("returns correct style for bottomLeft placement", () => {
    const style = getPlacementStyle("bottomLeft");
    expect(style).toBe("bottom-3 sm:left-3");
  });

  test("returns correct style for center placement", () => {
    const style = getPlacementStyle("center");
    expect(style).toBe("top-1/2 left-1/2 transform -translate-x-1/2! -translate-y-1/2");
  });

  test("returns default style for invalid placement", () => {
    // @ts-expect-error -- testing with an invalid placement
    const style = getPlacementStyle("invalidPlacement");
    expect(style).toBe("bottom-3 sm:right-3");
  });
});

describe("mirrorPlacementForDir", () => {
  test("mirrors the horizontal side of every corner placement in RTL", () => {
    expect(mirrorPlacementForDir("bottomRight", "rtl")).toBe("bottomLeft");
    expect(mirrorPlacementForDir("bottomLeft", "rtl")).toBe("bottomRight");
    expect(mirrorPlacementForDir("topRight", "rtl")).toBe("topLeft");
    expect(mirrorPlacementForDir("topLeft", "rtl")).toBe("topRight");
  });

  test("leaves center untouched in RTL — it has no side to flip", () => {
    expect(mirrorPlacementForDir("center", "rtl")).toBe("center");
  });

  test("returns the authored placement unchanged for ltr and auto", () => {
    expect(mirrorPlacementForDir("bottomRight", "ltr")).toBe("bottomRight");
    expect(mirrorPlacementForDir("topLeft", "ltr")).toBe("topLeft");
    expect(mirrorPlacementForDir("bottomRight", "auto")).toBe("bottomRight");
  });

  test("is its own inverse, so switching the preview back to an LTR language restores the corner", () => {
    const placements = ["bottomRight", "bottomLeft", "topRight", "topLeft", "center"] as const;
    for (const placement of placements) {
      expect(mirrorPlacementForDir(mirrorPlacementForDir(placement, "rtl"), "rtl")).toBe(placement);
    }
  });
});

describe("isInsideSurveyRoot", () => {
  test("counts the card's own survey root and the separate root an open dropdown portals into", () => {
    // ENG-3552: in a preview the dropdown mounts inside the mock page, beside the card, so the preview
    // modal's click-outside check must not read picking an option as a click outside the survey.
    document.body.innerHTML = `
      <div id="preview-survey-base">
        <div id="card"><div id="fbjs"><button id="next">Next</button></div></div>
        <div id="fbjs"><div role="menu"><div id="option" role="menuitemradio">A</div></div></div>
        <div id="backdrop"></div>
      </div>`;

    expect(isInsideSurveyRoot(document.getElementById("next"))).toBe(true);
    expect(isInsideSurveyRoot(document.getElementById("option"))).toBe(true);
    expect(isInsideSurveyRoot(document.getElementById("backdrop"))).toBe(false);
    expect(isInsideSurveyRoot(null)).toBe(false);
  });
});

describe("resolvePreviewType", () => {
  test("keeps the preview type the caller asked for", () => {
    expect(resolvePreviewType("email", false)).toBe("email");
    expect(resolvePreviewType("fullwidth", true)).toBe("fullwidth");
  });

  test("falls back to a modal once app setup is done, else full width", () => {
    expect(resolvePreviewType(undefined, true)).toBe("modal");
    expect(resolvePreviewType(undefined, false)).toBe("fullwidth");
  });
});

describe("getPreviewPageUrl", () => {
  test("trims the page address test value", () => {
    expect(getPreviewPageUrl(true, "  https://example.com/a  ")).toBe("https://example.com/a");
  });

  test("is undefined for a blank value, a missing value or no page-address field", () => {
    expect(getPreviewPageUrl(true, "   ")).toBeUndefined();
    expect(getPreviewPageUrl(true, undefined)).toBeUndefined();
    expect(getPreviewPageUrl(false, "https://example.com")).toBeUndefined();
  });
});

describe("getModalBackground", () => {
  const styling = { cardBackgroundColor: { light: "#ffffff" } } as TSurveyStyling;

  test("uses the light card color in light appearance", () => {
    expect(getModalBackground("light", styling)).toBe("#ffffff");
  });

  test("uses the dark palette's card color in dark appearance", () => {
    const dark = getModalBackground("dark", styling);
    expect(dark).toBeDefined();
    expect(dark).not.toBe("#ffffff");
  });
});

describe("getFullScreenPreviewStyles", () => {
  test("pins the backdrop and frame to the viewport in full screen", () => {
    expect(getFullScreenPreviewStyles(true)).toEqual({
      backdrop: { position: "fixed", zIndex: 50, left: 0, top: 0 },
      frame: { left: "2.5%", top: 0 },
    });
  });

  test("leaves them in flow otherwise", () => {
    expect(getFullScreenPreviewStyles(false)).toEqual({
      backdrop: { position: "absolute", zIndex: 50, left: undefined, top: undefined },
      frame: { left: undefined, top: undefined },
    });
  });
});

describe("getSlidingAnimationClass", () => {
  test("slides in from the side in the browser frame", () => {
    expect(getSlidingAnimationClass("desktop", true)).toBe("translate-x-0 opacity-100");
    expect(getSlidingAnimationClass("desktop", false)).toBe("translate-x-32 opacity-0");
  });

  test("slides up from below in the phone frame", () => {
    expect(getSlidingAnimationClass("mobile", true)).toBe("bottom-0");
    expect(getSlidingAnimationClass("mobile", false)).toBe("-bottom-full");
  });

  test("has no animation class for any other mode", () => {
    expect(getSlidingAnimationClass("null", true)).toBe("");
  });
});

describe("resolvePreviewLanguageCode", () => {
  const language = (code: string, isDefault = false) => ({
    default: isDefault,
    language: {
      id: `lang-${code}`,
      code,
      alias: null,
      workspaceId: "ws",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  const enabled = [language("en", true), language("de")];

  test("keeps an enabled language picked in the preview", () => {
    expect(resolvePreviewLanguageCode("de", enabled)).toBe("de");
  });

  test("keeps the default language", () => {
    expect(resolvePreviewLanguageCode("default", enabled)).toBe("default");
  });

  test("falls back to the default once the picked language is no longer enabled", () => {
    expect(resolvePreviewLanguageCode("de", [language("en", true)])).toBe("default");
  });

  test("does not treat the default language's own code as a non-default pick", () => {
    expect(resolvePreviewLanguageCode("en", enabled)).toBe("default");
  });
});
