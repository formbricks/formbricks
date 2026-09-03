import { describe, expect, test } from "vitest";
import { ZWorkspaceUpdateActionInput } from "./workspace-update-input";

describe("ZWorkspaceUpdateActionInput", () => {
  test("accepts a language the survey runtime ships strings for", () => {
    expect(
      ZWorkspaceUpdateActionInput.safeParse({ config: { defaultSurveyLanguage: "de-DE" } }).success
    ).toBe(true);
    // Runtime-only languages are valid here even though the dashboard has no translation for them.
    expect(
      ZWorkspaceUpdateActionInput.safeParse({ config: { defaultSurveyLanguage: "it-IT" } }).success
    ).toBe(true);
  });

  test("accepts clearing the setting", () => {
    expect(ZWorkspaceUpdateActionInput.safeParse({ config: { defaultSurveyLanguage: null } }).success).toBe(
      true
    );
    expect(ZWorkspaceUpdateActionInput.safeParse({ config: {} }).success).toBe(true);
  });

  test("accepts a regional variant the runtime serves from its language's bundle", () => {
    for (const defaultSurveyLanguage of ["pt-PT", "de-AT", "es-MX", "en-GB"]) {
      const result = ZWorkspaceUpdateActionInput.safeParse({ config: { defaultSurveyLanguage } });
      expect(result.success, defaultSurveyLanguage).toBe(true);
    }
  });

  test("rejects a language the survey runtime ships no strings for", () => {
    // Only in the 215-entry workspace-language catalog, with no survey bundle behind them.
    for (const defaultSurveyLanguage of ["km-KH", "ne-NP", "aa-ET", "nonsense"]) {
      const result = ZWorkspaceUpdateActionInput.safeParse({ config: { defaultSurveyLanguage } });
      expect(result.success, defaultSurveyLanguage).toBe(false);
      expect(result.error?.issues[0].path).toEqual(["config", "defaultSurveyLanguage"]);
    }
  });

  test("leaves the rest of the workspace update contract alone", () => {
    expect(ZWorkspaceUpdateActionInput.safeParse({ name: "Renamed" }).success).toBe(true);
    expect(ZWorkspaceUpdateActionInput.safeParse({ name: "  " }).success).toBe(false);
  });
});
