import { describe, expect, test } from "vitest";
import type { TCreativeColors, TCreativeElementStyle, TCreativeStyle } from "@formbricks/creatives";
import { getCreativeContrastWarning } from "./contrast";

const SIZE = { fontSize: 14, paddingX: 16, paddingY: 8 };

const styleWith = (light: TCreativeColors, dark: TCreativeColors): TCreativeStyle => {
  const element: TCreativeElementStyle = {
    light,
    dark,
    desktop: SIZE,
    phone: SIZE,
    borderRadius: 8,
    fontWeight: 600,
  };
  return { element, button: null, pageFont: false, customCss: null };
};

const colors = (backgroundColor: string, textColor: string): TCreativeColors => ({
  backgroundColor,
  textColor,
  borderColor: null,
});

describe("contrast warning", () => {
  test("readable text in the appearance being edited raises nothing", () => {
    // White on blue-800 is 8.7:1, slate-900 on white 17.9:1.
    const style = styleWith(colors("#1e40af", "#ffffff"), colors("#ffffff", "#0f172a"));

    expect(getCreativeContrastWarning(style, "light")).toBeNull();
    expect(getCreativeContrastWarning(style, "dark")).toBeNull();
  });

  test("checks only the appearance being edited, rounded down", () => {
    // White on amber-500 is 2.15:1 in light; dark keeps a readable pair.
    const style = styleWith(colors("#f59e0b", "#ffffff"), colors("#1e40af", "#ffffff"));

    expect(getCreativeContrastWarning(style, "light")).toEqual({ appearance: "light", ratio: 2.1 });
    expect(getCreativeContrastWarning(style, "dark")).toBeNull();
  });

  test("a poor dark pair is flagged while editing dark only", () => {
    const style = styleWith(colors("#ffffff", "#0f172a"), colors("#0f172a", "#334155"));

    expect(getCreativeContrastWarning(style, "light")).toBeNull();
    expect(getCreativeContrastWarning(style, "dark")).toEqual({ appearance: "dark", ratio: 1.7 });
  });

  test("4.5:1 is the line: #767676 on white passes, #777777 (4.48:1) does not and never reads as 4.5", () => {
    expect(
      getCreativeContrastWarning(
        styleWith(colors("#ffffff", "#767676"), colors("#ffffff", "#767676")),
        "dark"
      )
    ).toBeNull();
    expect(
      getCreativeContrastWarning(
        styleWith(colors("#1e40af", "#ffffff"), colors("#ffffff", "#777777")),
        "dark"
      )
    ).toEqual({ appearance: "dark", ratio: 4.4 });
  });
});
