import { describe, expect, test } from "vitest";
import {
  applyOverlayTab,
  getCustomOverlayControlValues,
  getOverlayPreviewStyle,
  getOverlayTab,
} from "./utils";

describe("getOverlayTab", () => {
  test("shows the preset tab when nothing custom is set", () => {
    expect(getOverlayTab({ overlay: "none", overlayColor: null, overlayOpacity: null })).toBe("none");
    expect(getOverlayTab({ overlay: "light", overlayColor: null, overlayOpacity: null })).toBe("light");
    expect(getOverlayTab({ overlay: "dark", overlayColor: null, overlayOpacity: null })).toBe("dark");
  });

  test("shows Custom when either value is set on an overlay", () => {
    expect(getOverlayTab({ overlay: "dark", overlayColor: "#ff0000", overlayOpacity: null })).toBe("custom");
    expect(getOverlayTab({ overlay: "light", overlayColor: null, overlayOpacity: 30 })).toBe("custom");
  });

  test("ignores leftover custom values when there is no overlay", () => {
    expect(getOverlayTab({ overlay: "none", overlayColor: "#ff0000", overlayOpacity: 30 })).toBe("none");
  });
});

describe("applyOverlayTab", () => {
  test("a preset tab sets the overlay and clears the custom values", () => {
    expect(applyOverlayTab("light", "dark")).toEqual({
      overlay: "light",
      overlayColor: null,
      overlayOpacity: null,
    });
    expect(applyOverlayTab("none", "dark")).toEqual({
      overlay: "none",
      overlayColor: null,
      overlayOpacity: null,
    });
  });

  test("Custom keeps the current preset and prefills from it", () => {
    expect(applyOverlayTab("custom", "light")).toEqual({
      overlay: "light",
      overlayColor: "#90a1b9",
      overlayOpacity: 50,
    });
    expect(applyOverlayTab("custom", "dark")).toEqual({
      overlay: "dark",
      overlayColor: "#314158",
      overlayOpacity: 80,
    });
  });

  test("Custom from no overlay starts from the dark preset", () => {
    expect(applyOverlayTab("custom", "none")).toEqual({
      overlay: "dark",
      overlayColor: "#314158",
      overlayOpacity: 80,
    });
  });
});

describe("getCustomOverlayControlValues", () => {
  test("shows the stored values", () => {
    expect(
      getCustomOverlayControlValues({ overlay: "dark", overlayColor: "#ff0000", overlayOpacity: 40 })
    ).toEqual({ color: "#ff0000", opacity: 40 });
  });

  test("shows the preset for a half that is not set", () => {
    expect(
      getCustomOverlayControlValues({ overlay: "light", overlayColor: null, overlayOpacity: 30 })
    ).toEqual({
      color: "#90a1b9",
      opacity: 30,
    });
    expect(
      getCustomOverlayControlValues({ overlay: "dark", overlayColor: "#00ff00", overlayOpacity: null })
    ).toEqual({ color: "#00ff00", opacity: 80 });
  });
});

describe("getOverlayPreviewStyle", () => {
  test("keeps the preset class (no inline style) when nothing custom is set", () => {
    expect(
      getOverlayPreviewStyle({ overlay: "dark", overlayColor: null, overlayOpacity: null })
    ).toBeUndefined();
    expect(
      getOverlayPreviewStyle({ overlay: "none", overlayColor: "#ff0000", overlayOpacity: 40 })
    ).toBeUndefined();
  });

  test("paints a custom overlay inline", () => {
    expect(getOverlayPreviewStyle({ overlay: "dark", overlayColor: "#ff0000", overlayOpacity: 40 })).toEqual({
      backgroundColor: "rgba(255, 0, 0, 0.4)",
    });
  });
});
