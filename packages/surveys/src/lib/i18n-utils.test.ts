import { describe, expect, test } from "vitest";
import type { TSurveyLanguage } from "@formbricks/types/surveys/types";
import { getI18nLanguage } from "./i18n-utils";

const lang = (code: string, isDefault = false, enabled = true): TSurveyLanguage =>
  ({ language: { code }, default: isDefault, enabled }) as unknown as TSurveyLanguage;

describe("getI18nLanguage", () => {
  test("resolves 'default' to the survey's default language code", () => {
    expect(getI18nLanguage("default", [lang("en-US", true), lang("de-DE")])).toBe("en-US");
  });

  test("falls back to 'en' when no default is configured", () => {
    expect(getI18nLanguage("default", [])).toBe("en");
  });

  test("returns the exact configured code", () => {
    expect(getI18nLanguage("de-DE", [lang("de-DE"), lang("en-US", true)])).toBe("de-DE");
  });

  test("resolves a legacy request against a migrated survey code (returns the stored canonical code)", () => {
    // request `de`, survey already migrated to `de-DE` -> render in `de-DE` (its content key)
    expect(getI18nLanguage("de", [lang("de-DE"), lang("en-US", true)])).toBe("de-DE");
    expect(getI18nLanguage("pt", [lang("pt-BR"), lang("en-US", true)])).toBe("pt-BR");
  });

  test("resolves a canonical request against a not-yet-migrated / stale-cached survey code", () => {
    // request `de-DE`, survey still stores legacy `de` -> render in `de` (its content key)
    expect(getI18nLanguage("de-DE", [lang("de"), lang("en", true)])).toBe("de");
  });

  test("resolves a bare request to a configured region code", () => {
    expect(getI18nLanguage("en", [lang("en-US", true)])).toBe("en-US");
  });

  test("matches case-insensitively and across underscores", () => {
    expect(getI18nLanguage("DE_de", [lang("de-DE"), lang("en-US", true)])).toBe("de-DE");
  });

  test("returns the requested code unchanged when nothing matches", () => {
    expect(getI18nLanguage("fr", [lang("de-DE"), lang("en-US", true)])).toBe("fr");
  });
});
