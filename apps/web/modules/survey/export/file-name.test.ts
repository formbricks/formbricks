import { describe, expect, test } from "vitest";
import { getSurveyExportFileName, toSurveyExportBaseName } from "./file-name";

describe("toSurveyExportBaseName", () => {
  test.each([
    ["Product Feedback", "product-feedback"],
    ["  NPS   Q3 / 2026  ", "nps-q3-2026"],
    ["Café résumé — naïve", "cafe-resume-naive"],
    ["../../etc/passwd", "etc-passwd"],
    ['He said "hi" <script>', "he-said-hi-script"],
    ["Umfrage: Zufriedenheit & Loyalität", "umfrage-zufriedenheit-loyalitat"],
  ])("kebab-cases %j to %j", (input, expected) => {
    expect(toSurveyExportBaseName(input)).toBe(expected);
  });

  test("falls back to 'survey' when nothing safe remains", () => {
    expect(toSurveyExportBaseName("")).toBe("survey");
    expect(toSurveyExportBaseName("   ")).toBe("survey");
    expect(toSurveyExportBaseName("顧客満足度調査")).toBe("survey");
    expect(toSurveyExportBaseName("🚀🚀🚀")).toBe("survey");
  });

  test("caps very long names without a trailing hyphen", () => {
    const base = toSurveyExportBaseName(`${"word ".repeat(40)}end`);

    expect(base.length).toBeLessThanOrEqual(80);
    expect(base.endsWith("-")).toBe(false);
  });
});

describe("getSurveyExportFileName", () => {
  test("appends the .formbricks.json suffix", () => {
    expect(getSurveyExportFileName({ name: "Product Feedback" })).toBe("product-feedback.formbricks.json");
    expect(getSurveyExportFileName({ name: "" })).toBe("survey.formbricks.json");
  });
});
