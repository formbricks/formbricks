import { describe, expect, test } from "vitest";
import type { BannerThemeZodType } from "@formbricks/api-v3-schemas";
import { DEFAULT_CREATIVE_STYLING } from "./creative";
import {
  getDevicePlacement,
  getOwnColor,
  toBannerPlacement,
  withColorValue,
  withDevicePlacement,
} from "./styling-form";

const theme = (colors: Partial<BannerThemeZodType> = {}): BannerThemeZodType => ({
  ...DEFAULT_CREATIVE_STYLING.banner.theme,
  customStyles: true,
  ...colors,
});

describe("colours per appearance", () => {
  const set = { backgroundColor: { light: "#fef3c7", dark: "#1e293b" } };

  test("each appearance reads its own value; an unset one is null", () => {
    expect(getOwnColor(theme(set), "backgroundColor", "light")).toBe("#fef3c7");
    expect(getOwnColor(theme(set), "backgroundColor", "dark")).toBe("#1e293b");
    expect(
      getOwnColor(theme({ backgroundColor: { light: "#fef3c7" } }), "backgroundColor", "dark")
    ).toBeNull();
    expect(getOwnColor(theme(), "textColor", "light")).toBeNull();
  });

  test("a light edit keeps the dark value, and always writes both keys", () => {
    expect(withColorValue(theme(set), "backgroundColor", "light", "#fde68a", null)).toEqual({
      backgroundColor: { light: "#fde68a", dark: "#1e293b" },
    });
    expect(withColorValue(theme(), "textColor", "light", "#78350f", null)).toEqual({
      textColor: { light: "#78350f", dark: null },
    });
  });

  test("a dark edit keeps the light value", () => {
    expect(withColorValue(theme(set), "backgroundColor", "dark", "#0f172a", null)).toEqual({
      backgroundColor: { light: "#fef3c7", dark: "#0f172a" },
    });
  });

  test("a dark edit on a colour left to the workspace keeps light as it shows by setting it", () => {
    expect(withColorValue(theme(), "backgroundColor", "dark", "#0f172a", "#ffffff")).toEqual({
      backgroundColor: { light: "#ffffff", dark: "#0f172a" },
    });
  });

  test("without a light colour to keep (no border in light), a dark one can't be set", () => {
    expect(withColorValue(theme(), "borderColor", "dark", "#93c5fd", null)).toBeNull();
  });

  test("resetting dark goes back to the derived colour; resetting light hands the colour back", () => {
    expect(withColorValue(theme(set), "backgroundColor", "dark", null, null)).toEqual({
      backgroundColor: { light: "#fef3c7", dark: null },
    });
    expect(withColorValue(theme(set), "backgroundColor", "light", null, null)).toEqual({
      backgroundColor: null,
    });
  });
});

describe("banner layout", () => {
  test("a bottom banner is always an overlay, whatever layout was asked for", () => {
    expect(toBannerPlacement("bottom", "inPage")).toEqual({ placement: "bottom", layout: "overlay" });
    expect(toBannerPlacement("bottom")).toEqual({ placement: "bottom", layout: "overlay" });
  });

  test("a top banner is In page by default and keeps Overlay when picked", () => {
    expect(toBannerPlacement("top")).toEqual({ placement: "top", layout: "inPage" });
    expect(toBannerPlacement("top", "overlay")).toEqual({ placement: "top", layout: "overlay" });
  });
});

describe("phone position", () => {
  const desktopOnly = { desktop: { edge: "right" as const, offset: 60 }, phone: null };

  test("a phone without its own placement uses the desktop one", () => {
    expect(getDevicePlacement(desktopOnly, "phone")).toEqual({ edge: "right", offset: 60 });
  });

  test("moving the button on phone leaves desktop alone, and clearing it follows desktop again", () => {
    const moved = withDevicePlacement(desktopOnly, "phone", { edge: "bottom", offset: 90 });

    expect(moved).toEqual({ desktop: { edge: "right", offset: 60 }, phone: { edge: "bottom", offset: 90 } });
    expect(getDevicePlacement(moved, "desktop")).toEqual({ edge: "right", offset: 60 });
    expect(withDevicePlacement(moved, "phone", null)).toEqual(desktopOnly);
  });

  test("moving it on desktop keeps a phone placement of its own", () => {
    const moved = withDevicePlacement(
      { desktop: { edge: "right", offset: 60 }, phone: { edge: "bottom", offset: 90 } },
      "desktop",
      { edge: "left", offset: 20 }
    );

    expect(moved).toEqual({ desktop: { edge: "left", offset: 20 }, phone: { edge: "bottom", offset: 90 } });
  });
});
