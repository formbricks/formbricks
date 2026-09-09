import { describe, expect, test } from "vitest";
import { getDocumentName, getImportedSurveyName } from "./imported-survey-name";

describe("getImportedSurveyName", () => {
  test("appends the marker once", () => {
    expect(getImportedSurveyName("Product Feedback")).toBe("Product Feedback (imported)");
    expect(getImportedSurveyName("Product Feedback (imported)")).toBe("Product Feedback (imported)");
  });

  test("falls back for an empty name and caps the length at 200", () => {
    expect(getImportedSurveyName("   ")).toBe("Imported survey (imported)");
    expect(getImportedSurveyName(undefined, "Qualtrics survey")).toBe("Qualtrics survey (imported)");

    const long = getImportedSurveyName("x".repeat(250));
    expect(long.length).toBeLessThanOrEqual(200);
    expect(long.endsWith(" (imported)")).toBe(true);
  });
});

describe("getDocumentName", () => {
  test("reads the name from a document record only", () => {
    expect(getDocumentName({ name: "Survey" })).toBe("Survey");
    expect(getDocumentName({ name: 1 })).toBeUndefined();
    expect(getDocumentName(null)).toBeUndefined();
  });
});
