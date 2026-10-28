import { describe, expect, test } from "vitest";
import type { TCreativeColors, TCreativeStyle } from "@formbricks/creatives";
import type { TShowConditionSingle } from "@formbricks/types/show-conditions";
import { DEFAULT_CREATIVE_STYLING } from "./creative";
import {
  countShowConditions,
  getColorsSummary,
  getCustomCssSummary,
  getPositionSummary,
  getScheduleSummaryFormat,
  getShapeSummary,
} from "./panel-summaries";
import type { TCreativeStylingForm } from "./styling-form";

const LIGHT: TCreativeColors = { backgroundColor: "#0f172a", textColor: "#ffffff", borderColor: null };
const DARK: TCreativeColors = { backgroundColor: "#1e293b", textColor: "#f8fafc", borderColor: "#334155" };

const style: TCreativeStyle = {
  element: {
    light: LIGHT,
    dark: DARK,
    desktop: { fontSize: 15, paddingX: 18, paddingY: 10 },
    phone: { fontSize: 13, paddingX: 12, paddingY: 8 },
    borderRadius: 12,
    fontWeight: 500,
  },
  button: null,
  pageFont: true,
  customCss: null,
};

const button = (
  theme: Partial<Extract<TCreativeStylingForm, { type: "feedbackButton" }>["theme"]> = {},
  phone: { edge: "left" | "right" | "bottom"; offset: number } | null = null
): TCreativeStylingForm => ({
  type: "feedbackButton",
  position: { desktop: { edge: "right", offset: 50 }, phone },
  theme: { ...DEFAULT_CREATIVE_STYLING.feedbackButton.theme, customStyles: true, ...theme },
});

const banner = (customStyles = true): TCreativeStylingForm => ({
  type: "banner",
  position: { desktop: { placement: "bottom", layout: "overlay" }, phone: null },
  theme: { ...DEFAULT_CREATIVE_STYLING.banner.theme, customStyles },
});

describe("Colors", () => {
  test("with custom styles off it follows the Look & Feel", () => {
    expect(getColorsSummary(button({ customStyles: false }), style, "light")).toEqual({
      kind: "lookAndFeel",
    });
  });

  test("shows the colours on screen and counts only the edited appearance's own values", () => {
    const styling = button({
      backgroundColor: { light: "#0f172a", dark: null },
      textColor: { light: "#ffffff" },
    });

    expect(getColorsSummary(styling, style, "light")).toEqual({
      kind: "colors",
      background: "#0f172a",
      text: "#ffffff",
      border: null,
      ownCount: 2,
    });
    expect(getColorsSummary(styling, style, "dark")).toMatchObject({ border: "#334155", ownCount: 0 });
  });
});

describe("Shape & size", () => {
  test("a feedback button reads its font, the edited device's size and its corners", () => {
    expect(getShapeSummary(button(), style, "phone")).toEqual({
      kind: "shape",
      pageFont: true,
      fontSize: 13,
      borderRadius: 12,
    });
  });

  test("a banner has no corner radius, and custom styles off follow the Look & Feel", () => {
    expect(getShapeSummary(banner(), style, "desktop")).toMatchObject({ fontSize: 15, borderRadius: null });
    expect(getShapeSummary(banner(false), style, "desktop")).toEqual({ kind: "lookAndFeel" });
  });
});

describe("Position", () => {
  test("a phone without its own placement shows the desktop one", () => {
    expect(getPositionSummary(button(), "phone")).toEqual({
      kind: "feedbackButton",
      edge: "right",
      offset: 50,
      ownPhonePosition: false,
    });
  });

  test("an own phone placement is mentioned on desktop and shown on phone", () => {
    const styling = button({}, { edge: "bottom", offset: 20 });

    expect(getPositionSummary(styling, "desktop")).toMatchObject({ edge: "right", ownPhonePosition: true });
    expect(getPositionSummary(styling, "phone")).toMatchObject({
      edge: "bottom",
      offset: 20,
      ownPhonePosition: false,
    });
  });

  test("a banner reads its edge and layout, even with custom styles off", () => {
    expect(getPositionSummary(banner(false), "desktop")).toEqual({
      kind: "banner",
      edge: "bottom",
      layout: "overlay",
      ownPhonePosition: false,
    });
  });
});

describe("Custom CSS", () => {
  test("off without custom styles, empty when both fields are blank", () => {
    expect(getCustomCssSummary({ light: ".a { color: red; }", dark: "" }, false)).toEqual({ kind: "off" });
    expect(getCustomCssSummary(null, true)).toEqual({ kind: "empty" });
    expect(getCustomCssSummary({ light: "  \n", dark: "" }, true)).toEqual({ kind: "empty" });
  });

  test("counts lines that hold something, per appearance", () => {
    const source = { light: ".a {\n  color: red;\n\n}\n", dark: ".a { color: white; }" };
    expect(getCustomCssSummary(source, true)).toEqual({ kind: "lines", light: 3, dark: 1 });
  });
});

describe("Show when", () => {
  const condition = (id: string): TShowConditionSingle => ({
    id,
    leftOperand: { type: "visit", value: "pagesViewed" },
    operator: "isGreaterThan",
    rightOperand: { type: "static", value: 2 },
  });

  test("counts the conditions inside nested groups, and none when empty", () => {
    expect(countShowConditions(null)).toBe(0);
    expect(countShowConditions({ id: "root", connector: "and", conditions: [] })).toBe(0);
    expect(
      countShowConditions({
        id: "root",
        connector: "and",
        conditions: [
          condition("a"),
          { id: "group", connector: "or", conditions: [condition("b"), condition("c")] },
        ],
      })
    ).toBe(3);
  });
});

describe("Schedule", () => {
  const now = new Date(2026, 9, 27);

  test("leaves the year out when it is the current one", () => {
    expect(getScheduleSummaryFormat(new Date(2026, 10, 3, 9), now)).not.toHaveProperty("year");
    expect(getScheduleSummaryFormat(new Date(2027, 0, 5, 9), now)).toMatchObject({ year: "numeric" });
  });
});
