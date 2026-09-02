import { describe, expect, test } from "vitest";
import {
  isWorkspaceDefaultSurveyLanguage,
  resolveDefaultSurveyLanguage,
  resolveTemplateTextLocale,
} from "./default-survey-language";

describe("resolveDefaultSurveyLanguage", () => {
  test("the workspace setting wins over the creator's locale", () => {
    expect(resolveDefaultSurveyLanguage({ workspaceDefaultLanguage: "de-DE", userLocale: "en-US" })).toBe(
      "de-DE"
    );
  });

  test("a runtime-only language can be the workspace default", () => {
    // it-IT ships survey strings but not dashboard strings, so it is selectable here even though it is
    // not a valid TUserLocale.
    expect(resolveDefaultSurveyLanguage({ workspaceDefaultLanguage: "it-IT", userLocale: "en-US" })).toBe(
      "it-IT"
    );
  });

  test("a legacy workspace language code resolves to its canonical tag", () => {
    expect(resolveDefaultSurveyLanguage({ workspaceDefaultLanguage: "de", userLocale: "en-US" })).toBe(
      "de-DE"
    );
    expect(resolveDefaultSurveyLanguage({ workspaceDefaultLanguage: "zh-CN", userLocale: "en-US" })).toBe(
      "zh-Hans-CN"
    );
  });

  test("falls back to the creator's locale when the setting is unset", () => {
    expect(resolveDefaultSurveyLanguage({ userLocale: "fr-FR" })).toBe("fr-FR");
    expect(resolveDefaultSurveyLanguage({ workspaceDefaultLanguage: null, userLocale: "fr-FR" })).toBe(
      "fr-FR"
    );
    expect(resolveDefaultSurveyLanguage({ workspaceDefaultLanguage: undefined, userLocale: "fr-FR" })).toBe(
      "fr-FR"
    );
  });

  test("falls back to the creator's locale when the setting names an unsupported language", () => {
    // Persisted directly into the config JSON, or left behind by a wider picker: the survey runtime
    // ships no strings for these, so they must not reach a survey.
    expect(resolveDefaultSurveyLanguage({ workspaceDefaultLanguage: "km-KH", userLocale: "fr-FR" })).toBe(
      "fr-FR"
    );
    expect(resolveDefaultSurveyLanguage({ workspaceDefaultLanguage: "pt-PT", userLocale: "fr-FR" })).toBe(
      "fr-FR"
    );
    expect(resolveDefaultSurveyLanguage({ workspaceDefaultLanguage: "nonsense", userLocale: "fr-FR" })).toBe(
      "fr-FR"
    );
  });

  test("falls back to English when neither the setting nor the locale is usable", () => {
    expect(resolveDefaultSurveyLanguage({})).toBe("en-US");
    expect(resolveDefaultSurveyLanguage({ userLocale: null })).toBe("en-US");
    // A locale the dashboard does not support is not a valid authoring language either.
    expect(resolveDefaultSurveyLanguage({ userLocale: "it-IT" })).toBe("en-US");
  });
});

describe("resolveTemplateTextLocale", () => {
  test("keeps a language the dashboard is translated into", () => {
    expect(resolveTemplateTextLocale("de-DE")).toBe("de-DE");
    expect(resolveTemplateTextLocale("pt-PT")).toBe("pt-PT");
  });

  test("falls back to English for a runtime-only language", () => {
    expect(resolveTemplateTextLocale("it-IT")).toBe("en-US");
    expect(resolveTemplateTextLocale("ur-PK")).toBe("en-US");
  });
});

describe("isWorkspaceDefaultSurveyLanguage", () => {
  test("matches the language the setting names", () => {
    expect(isWorkspaceDefaultSurveyLanguage("de-DE", "de-DE")).toBe(true);
  });

  test("matches a row stored under a legacy or differently cased code", () => {
    expect(isWorkspaceDefaultSurveyLanguage("de", "de-DE")).toBe(true);
    expect(isWorkspaceDefaultSurveyLanguage("DE-de", "de-DE")).toBe(true);
    expect(isWorkspaceDefaultSurveyLanguage("zh-CN", "zh-Hans-CN")).toBe(true);
  });

  test("does not match a different language", () => {
    expect(isWorkspaceDefaultSurveyLanguage("fr-FR", "de-DE")).toBe(false);
    // Script matters: Traditional Chinese is not the Simplified default.
    expect(isWorkspaceDefaultSurveyLanguage("zh-Hant-TW", "zh-Hans-CN")).toBe(false);
  });

  test("nothing is the default when the setting is unset or unusable", () => {
    expect(isWorkspaceDefaultSurveyLanguage("de-DE", null)).toBe(false);
    expect(isWorkspaceDefaultSurveyLanguage("de-DE", undefined)).toBe(false);
    expect(isWorkspaceDefaultSurveyLanguage("km-KH", "km-KH")).toBe(false);
  });
});
