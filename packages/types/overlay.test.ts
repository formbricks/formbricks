import { describe, expect, test } from "vitest";
import {
  ZOverlayAppearance,
  ZOverlayColor,
  ZOverlayOpacity,
  getOverlayBackground,
  isCustomOverlay,
  resolveOverlayAppearance,
} from "./overlay";

describe("getOverlayBackground", () => {
  test.each([
    ["none", "none" as const],
    ["light", "light" as const],
    ["dark", "dark" as const],
  ])("returns undefined for a %s overlay with no custom values, so the preset class stays", (_, overlay) => {
    expect(getOverlayBackground({ overlay, color: null, opacity: null })).toBeUndefined();
    expect(getOverlayBackground({ overlay })).toBeUndefined();
  });

  test("returns undefined for no overlay even when custom values are set", () => {
    expect(getOverlayBackground({ overlay: "none", color: "#ff0000", opacity: 40 })).toBeUndefined();
  });

  test("paints both custom values", () => {
    expect(getOverlayBackground({ overlay: "dark", color: "#ff0000", opacity: 40 })).toBe(
      "rgba(255, 0, 0, 0.4)"
    );
  });

  test("fills a missing opacity from the preset of the chosen overlay", () => {
    expect(getOverlayBackground({ overlay: "light", color: "#ff0000", opacity: null })).toBe(
      "rgba(255, 0, 0, 0.5)"
    );
    expect(getOverlayBackground({ overlay: "dark", color: "#ff0000", opacity: null })).toBe(
      "rgba(255, 0, 0, 0.8)"
    );
  });

  test("fills a missing colour from the preset of the chosen overlay", () => {
    expect(getOverlayBackground({ overlay: "dark", color: null, opacity: 25 })).toBe(
      "rgba(49, 65, 88, 0.25)"
    );
    expect(getOverlayBackground({ overlay: "light", color: null, opacity: 100 })).toBe(
      "rgba(144, 161, 185, 1)"
    );
  });

  test("expands a 3-digit colour", () => {
    expect(getOverlayBackground({ overlay: "dark", color: "#f00", opacity: 10 })).toBe(
      "rgba(255, 0, 0, 0.1)"
    );
  });

  test("treats stored values that do not parse as unset, so it never paints an invisible overlay", () => {
    expect(getOverlayBackground({ overlay: "dark", color: "not-a-colour", opacity: 3 })).toBeUndefined();
    expect(getOverlayBackground({ overlay: "dark", color: "#ff000080", opacity: 40 })).toBe(
      "rgba(49, 65, 88, 0.4)"
    );
  });
});

describe("resolveOverlayAppearance", () => {
  const workspace = { overlay: "dark" as const, overlayColor: "#ff0000", overlayOpacity: 40 };

  test("takes all three values from the workspace when the survey does not override the overlay", () => {
    expect(resolveOverlayAppearance(null, workspace)).toEqual({
      overlay: "dark",
      color: "#ff0000",
      opacity: 40,
    });
    expect(resolveOverlayAppearance({ overlay: null, overlayOpacity: 90 }, workspace)).toEqual({
      overlay: "dark",
      color: "#ff0000",
      opacity: 40,
    });
  });

  test("takes all three values from the survey when it overrides the overlay", () => {
    expect(
      resolveOverlayAppearance({ overlay: "light", overlayColor: "#00ff00", overlayOpacity: 20 }, workspace)
    ).toEqual({ overlay: "light", color: "#00ff00", opacity: 20 });
  });

  test("a survey that overrides the overlay never inherits the workspace's custom values", () => {
    expect(resolveOverlayAppearance({ overlay: "light", overlayColor: null }, workspace)).toEqual({
      overlay: "light",
      color: null,
      opacity: null,
    });
  });

  test("defaults missing values to a preset with no overlay", () => {
    expect(resolveOverlayAppearance(undefined, {})).toEqual({ overlay: "none", color: null, opacity: null });
  });

  test("drops stored values that do not parse", () => {
    expect(
      resolveOverlayAppearance(null, { overlay: "dark", overlayColor: "red", overlayOpacity: 101 })
    ).toEqual({ overlay: "dark", color: null, opacity: null });
  });
});

describe("isCustomOverlay", () => {
  test("is true when an overlay has either custom value", () => {
    expect(isCustomOverlay({ overlay: "dark", color: "#ff0000", opacity: null })).toBe(true);
    expect(isCustomOverlay({ overlay: "light", color: null, opacity: 30 })).toBe(true);
  });

  test("is false for a preset or for no overlay", () => {
    expect(isCustomOverlay({ overlay: "dark", color: null, opacity: null })).toBe(false);
    expect(isCustomOverlay({ overlay: "none", color: "#ff0000", opacity: 30 })).toBe(false);
  });

  test("is false when the stored values do not parse, matching what getOverlayBackground paints", () => {
    expect(isCustomOverlay({ overlay: "dark", color: "red", opacity: null })).toBe(false);
    expect(isCustomOverlay({ overlay: "light", color: "#ff000080", opacity: 101 })).toBe(false);
  });
});

describe("overlay schemas", () => {
  test.each([
    [9, false],
    [10, true],
    [55, true],
    [100, true],
    [101, false],
    [50.5, false],
  ])("opacity %s is valid: %s", (value, valid) => {
    expect(ZOverlayOpacity.safeParse(value).success).toBe(valid);
  });

  test.each([
    ["#abc", true],
    ["#AABBCC", true],
    ["#aabbccdd", false],
    ["#abcd", false],
    ["aabbcc", false],
    ["#gggggg", false],
  ])("colour %s is valid: %s", (value, valid) => {
    expect(ZOverlayColor.safeParse(value).success).toBe(valid);
  });

  test("appearance accepts nulls", () => {
    expect(ZOverlayAppearance.safeParse({ color: null, opacity: null }).success).toBe(true);
  });
});
