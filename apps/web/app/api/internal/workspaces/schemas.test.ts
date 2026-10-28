import { describe, expect, test } from "vitest";
import { ZWorkspacePatchBody } from "./schemas";

const parse = (body: unknown) => ZWorkspacePatchBody.safeParse(body);

describe("ZWorkspacePatchBody", () => {
  test("accepts a default survey language the survey runtime ships strings for", () => {
    expect(parse({ config: { defaultSurveyLanguage: "de-DE" } }).success).toBe(true);
    // Runtime-only languages are valid here even though the dashboard has no translation for them.
    expect(parse({ config: { defaultSurveyLanguage: "it-IT" } }).success).toBe(true);
  });

  test("accepts clearing the default survey language", () => {
    expect(parse({ config: { defaultSurveyLanguage: null } }).success).toBe(true);
    expect(parse({ config: {} }).success).toBe(true);
  });

  test("accepts a regional variant the runtime serves from its language's bundle", () => {
    for (const defaultSurveyLanguage of ["pt-PT", "de-AT", "es-MX", "en-GB"]) {
      expect(parse({ config: { defaultSurveyLanguage } }).success, defaultSurveyLanguage).toBe(true);
    }
  });

  test("rejects a default survey language the survey runtime ships no strings for", () => {
    // Only in the 215-entry workspace-language catalog, with no survey bundle behind them.
    for (const defaultSurveyLanguage of ["fa-IR", "aa-ET", "nonsense"]) {
      const result = parse({ config: { defaultSurveyLanguage } });
      expect(result.success, defaultSurveyLanguage).toBe(false);
      expect(result.error?.issues[0].path).toEqual(["config", "defaultSurveyLanguage"]);
    }
  });

  test("trims the name and refuses a blank one", () => {
    expect(parse({ name: "  Renamed " }).data).toEqual({ name: "Renamed" });
    expect(parse({ name: "  " }).success).toBe(false);
  });

  test("coerces a logo write's baseline to a date, and requires it with the logo", () => {
    const logo = { url: "https://example.com/logo.png" };
    expect(parse({ logo, expectedUpdatedAt: "2026-10-01T10:00:00.000Z" }).data).toEqual({
      logo,
      expectedUpdatedAt: new Date("2026-10-01T10:00:00.000Z"),
    });
    expect(parse({ logo }).error?.issues[0].path).toEqual(["expectedUpdatedAt"]);
  });
});
