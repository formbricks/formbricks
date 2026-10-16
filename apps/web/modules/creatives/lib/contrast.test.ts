import { describe, expect, test } from "vitest";
import type { TCreativeColors, TCreativeElementStyle, TCreativeStyle } from "@formbricks/creatives";
import { getCreativeContrastWarnings } from "./contrast";

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
  test("readable text in both appearances raises nothing", () => {
    // White on blue-800 is 8.7:1, slate-900 on white 17.9:1.
    expect(
      getCreativeContrastWarnings(styleWith(colors("#1e40af", "#ffffff"), colors("#ffffff", "#0f172a")))
    ).toEqual([]);
  });

  test("text below 4.5:1 in one appearance is flagged for that appearance, rounded down", () => {
    // White on amber-500 is 2.15:1; dark keeps a readable pair.
    expect(
      getCreativeContrastWarnings(styleWith(colors("#f59e0b", "#ffffff"), colors("#1e40af", "#ffffff")))
    ).toEqual([{ appearances: ["light"], ratio: 2.1 }]);
  });

  test("4.5:1 is the line: #767676 on white passes, #777777 (4.48:1) does not and never reads as 4.5", () => {
    expect(
      getCreativeContrastWarnings(styleWith(colors("#ffffff", "#767676"), colors("#ffffff", "#767676")))
    ).toEqual([]);
    expect(
      getCreativeContrastWarnings(styleWith(colors("#1e40af", "#ffffff"), colors("#ffffff", "#777777")))
    ).toEqual([{ appearances: ["dark"], ratio: 4.4 }]);
  });

  test("the same colours in light and dark (a custom pair) give one warning for both", () => {
    const pair = colors("#ffffff", "#94a3b8");

    expect(getCreativeContrastWarnings(styleWith(pair, pair))).toEqual([
      { appearances: ["light", "dark"], ratio: 2.5 },
    ]);
  });

  test("different poor pairs in light and dark are reported separately", () => {
    expect(
      getCreativeContrastWarnings(styleWith(colors("#ffffff", "#94a3b8"), colors("#0f172a", "#334155")))
    ).toEqual([
      { appearances: ["light"], ratio: 2.5 },
      { appearances: ["dark"], ratio: 1.7 },
    ]);
  });
});
