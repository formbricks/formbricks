import { describe, expect, test } from "vitest";
import { TSurvey, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { applyAutoSelectLanguageRule } from "./auto-select-language";

const surveyLanguage = (code: string, isDefault = false, enabled = true): TSurveyLanguage => ({
  default: isDefault,
  enabled,
  language: {
    id: `lang-${code}`,
    code,
    alias: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    workspaceId: "workspace-1",
  },
});

const survey = (languages: TSurveyLanguage[], autoSelectLanguage?: boolean | null): TSurvey =>
  ({ id: "survey-1", languages, autoSelectLanguage }) as unknown as TSurvey;

describe("applyAutoSelectLanguageRule", () => {
  test("turns it on when multi-language is first activated", () => {
    const next = survey([surveyLanguage("en-US", true)], null);
    expect(applyAutoSelectLanguageRule(survey([], null), next).autoSelectLanguage).toBe(true);
    // Also after an earlier deactivation reset it to off.
    expect(applyAutoSelectLanguageRule(survey([], false), { ...next, autoSelectLanguage: false })).toEqual({
      ...next,
      autoSelectLanguage: true,
    });
  });

  test("turns it off when multi-language is deactivated", () => {
    const previous = survey([surveyLanguage("en-US", true), surveyLanguage("de-DE")], true);
    expect(applyAutoSelectLanguageRule(previous, survey([], true)).autoSelectLanguage).toBe(false);
  });

  test("turns it on when an unset survey starts offering a second language", () => {
    const previous = survey([surveyLanguage("en-US", true)], null);
    const next = survey([surveyLanguage("en-US", true), surveyLanguage("de-DE")], null);
    expect(applyAutoSelectLanguageRule(previous, next)).toEqual({ ...next, autoSelectLanguage: true });
    // Re-enabling a disabled second language is the same transition.
    const withDisabled = survey([surveyLanguage("en-US", true), surveyLanguage("de-DE", false, false)], null);
    expect(applyAutoSelectLanguageRule(withDisabled, next).autoSelectLanguage).toBe(true);
  });

  test("keeps an explicit choice when a second language is added", () => {
    const previous = survey([surveyLanguage("en-US", true)], false);
    const next = survey([surveyLanguage("en-US", true), surveyLanguage("de-DE")], false);
    expect(applyAutoSelectLanguageRule(previous, next)).toBe(next);
    const nextOn = { ...next, autoSelectLanguage: true };
    expect(applyAutoSelectLanguageRule({ ...previous, autoSelectLanguage: true }, nextOn)).toBe(nextOn);
  });

  test("does not count a disabled language as offered", () => {
    const previous = survey([surveyLanguage("en-US", true)], null);
    const next = survey([surveyLanguage("en-US", true), surveyLanguage("de-DE", false, false)], null);
    expect(applyAutoSelectLanguageRule(previous, next)).toBe(next);
  });

  test("leaves the creator's choice alone while multi-language stays active", () => {
    const previous = survey([surveyLanguage("en-US", true), surveyLanguage("de-DE")], false);
    const next = survey([surveyLanguage("en-US", true)], false);
    expect(applyAutoSelectLanguageRule(previous, next)).toBe(next);
  });

  test("leaves a survey without languages untouched", () => {
    const next = survey([], null);
    expect(applyAutoSelectLanguageRule(survey([], null), next)).toBe(next);
  });
});
