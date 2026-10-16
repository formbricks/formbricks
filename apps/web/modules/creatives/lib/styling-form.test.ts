import { describe, expect, test } from "vitest";
import { getDevicePlacement, toBannerPlacement, withDevicePlacement } from "./styling-form";

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
