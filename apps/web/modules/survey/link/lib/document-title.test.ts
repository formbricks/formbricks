import { describe, expect, test } from "vitest";
import { buildSurveyDocumentTitle } from "./document-title";

describe("buildSurveyDocumentTitle", () => {
  test("appends the step to the base title", () => {
    expect(buildSurveyDocumentTitle("Q3 Customer Satisfaction | Formbricks", "Page 2 of 5")).toBe(
      "Q3 Customer Satisfaction | Formbricks — Page 2 of 5"
    );
  });

  test("returns the base unchanged when there is no step", () => {
    expect(buildSurveyDocumentTitle("Q3 Customer Satisfaction")).toBe("Q3 Customer Satisfaction");
  });

  test("returns the base unchanged for a blank step", () => {
    // A dangling "Survey —" is worse than no position at all.
    expect(buildSurveyDocumentTitle("Q3 Customer Satisfaction", "   ")).toBe("Q3 Customer Satisfaction");
    expect(buildSurveyDocumentTitle("Q3 Customer Satisfaction", "")).toBe("Q3 Customer Satisfaction");
  });

  test("falls back to the step alone when the base title is empty", () => {
    // Nothing in the chain should produce a leading separator.
    expect(buildSurveyDocumentTitle("", "Page 1 of 3")).toBe("Page 1 of 3");
    expect(buildSurveyDocumentTitle("   ", "Page 1 of 3")).toBe("Page 1 of 3");
  });

  test("returns an empty string when neither part has content", () => {
    expect(buildSurveyDocumentTitle("", "")).toBe("");
  });

  test("trims surrounding whitespace off both parts", () => {
    expect(buildSurveyDocumentTitle("  Survey  ", "  Page 1 of 2  ")).toBe("Survey — Page 1 of 2");
  });

  test("keeps a localized step label verbatim", () => {
    // The label arrives already localized in the survey's language; nothing here may reformat it.
    expect(buildSurveyDocumentTitle("Umfrage", "Seite 2 von 5")).toBe("Umfrage — Seite 2 von 5");
    expect(buildSurveyDocumentTitle("アンケート", "5 ページ中 2 ページ")).toBe(
      "アンケート — 5 ページ中 2 ページ"
    );
  });
});
