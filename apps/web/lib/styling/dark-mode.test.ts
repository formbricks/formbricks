import { describe, expect, test } from "vitest";
import { getDerivedDarkColors } from "@formbricks/types/dark-palette";
import { getAppearanceFieldName, getColorKey, getDarkDisplayColor } from "./dark-mode";

describe("getAppearanceFieldName", () => {
  test("points a light color path at its dark slot in the Dark tab", () => {
    expect(getAppearanceFieldName("brandColor.light", "dark")).toBe("brandColor.dark");
  });

  test("leaves light mode and non-color fields alone", () => {
    expect(getAppearanceFieldName("brandColor.light", "light")).toBe("brandColor.light");
    expect(getAppearanceFieldName("roundness", "dark")).toBe("roundness");
  });
});

describe("getColorKey", () => {
  test("reads the styling key from a color path", () => {
    expect(getColorKey("cardBackgroundColor.dark")).toBe("cardBackgroundColor");
    expect(getColorKey("roundness")).toBeUndefined();
  });
});

describe("getDarkDisplayColor", () => {
  test("shows the derived color when no dark value is set", () => {
    expect(getDarkDisplayColor({ brandColor: { light: "#146a5d" } }, "cardBackgroundColor.light")).toBe(
      getDerivedDarkColors("#146a5d").cardBackgroundColor
    );
  });

  test("shows the light value for a brand color (D12)", () => {
    expect(getDarkDisplayColor({ buttonBgColor: { light: "#146a5d" } }, "buttonBgColor.light")).toBe(
      "#146a5d"
    );
  });

  test("shows the creator's dark value when one is set", () => {
    expect(
      getDarkDisplayColor(
        { cardBackgroundColor: { light: "#ffffff", dark: "#101010" } },
        "cardBackgroundColor.dark"
      )
    ).toBe("#101010");
  });
});
