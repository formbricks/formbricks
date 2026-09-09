import { describe, expect, test } from "vitest";
import type { TSurveyLanguage } from "@formbricks/types/surveys/types";
import { localizeSurveyString, resolveV3LabelContext } from "./label-resolution";

const language = (code: string, isDefault = false, enabled = true): TSurveyLanguage =>
  ({ language: { code }, default: isDefault, enabled }) as TSurveyLanguage;

const LANGUAGES = [language("en", true), language("de"), language("pt-BR")];

describe("resolveV3LabelContext", () => {
  /**
   * The distinction the whole module exists for: the survey's default language is keyed under the
   * literal `"default"` in every i18n map, while the response stores the real code. Looking labels up
   * under `"en"` for an English-default survey finds nothing.
   */
  test("the default language looks up under `default` but reports its real code", () => {
    expect(resolveV3LabelContext(LANGUAGES, "en")).toEqual({ lookupKey: "default", labelsLanguage: "en" });
  });

  test("a non-default language looks up and reports under its own code", () => {
    expect(resolveV3LabelContext(LANGUAGES, "de")).toEqual({ lookupKey: "de", labelsLanguage: "de" });
  });

  /** Canonicalization is recent; rows written before it still have to serialize. */
  test("matches case-insensitively, so a legacy `pt-br` still finds `pt-BR`", () => {
    expect(resolveV3LabelContext(LANGUAGES, "pt-br")).toEqual({
      lookupKey: "pt-BR",
      labelsLanguage: "pt-BR",
    });
  });

  /** A language removed from the survey after collection must not break the read. */
  test("an unrecognised language falls back to the default rather than failing", () => {
    expect(resolveV3LabelContext(LANGUAGES, "fr")).toEqual({ lookupKey: "default", labelsLanguage: "en" });
  });

  test("a response with no language uses the default", () => {
    expect(resolveV3LabelContext(LANGUAGES, null)).toEqual({ lookupKey: "default", labelsLanguage: "en" });
  });

  /** `labelsLanguage` is nullable precisely for the single-language survey that declares nothing. */
  test("a survey with no declared languages reports null rather than inventing a code", () => {
    expect(resolveV3LabelContext([], null)).toEqual({ lookupKey: "default", labelsLanguage: null });
    expect(resolveV3LabelContext([], "en")).toEqual({ lookupKey: "default", labelsLanguage: null });
  });

  /** `"default"` is an internal key; emitting it as a language code would be meaningless to a client. */
  test("never reports the literal `default` as the language", () => {
    for (const responseLanguage of ["en", "de", "fr", null]) {
      expect(resolveV3LabelContext(LANGUAGES, responseLanguage).labelsLanguage).not.toBe("default");
    }
  });
});

describe("localizeSurveyString", () => {
  test("returns the requested translation when there is one", () => {
    expect(localizeSurveyString({ default: "How satisfied?", de: "Wie zufrieden?" }, "de")).toBe(
      "Wie zufrieden?"
    );
  });

  /**
   * The behaviour that separates the two implementations in this repo. `apps/web/lib/i18n/utils.ts`
   * returns `""` here. Using it would make every choice value on a partially translated survey fail
   * to match its option and fall into `unresolved[]` — the ENG-2001 bug class.
   */
  test.each([
    ["missing", { default: "How satisfied?" }],
    ["empty", { default: "How satisfied?", de: "" }],
    ["whitespace only", { default: "How satisfied?", de: "   " }],
  ])("falls back to `default` when the translation is %s", (_label, value) => {
    expect(localizeSurveyString(value, "de")).toBe("How satisfied?");
  });

  test("resolves `default` directly", () => {
    expect(localizeSurveyString({ default: "How satisfied?", de: "Wie zufrieden?" }, "default")).toBe(
      "How satisfied?"
    );
  });

  test("an absent or non-i18n value is the empty string, not a crash", () => {
    expect(localizeSurveyString(undefined, "default")).toBe("");
    expect(localizeSurveyString("plain" as never, "default")).toBe("");
  });
});
