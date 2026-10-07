import { describe, expect, test } from "vitest";
import { isReportableLanguageCode, normalizeQualtricsLanguageCode } from "./language-codes";

describe("normalizeQualtricsLanguageCode", () => {
  test.each([
    ["EN", "en-US"],
    ["EN-GB", "en-GB"],
    ["DE", "de-DE"],
    ["de_at", "de-AT"],
    ["PT-BR", "pt-BR"],
    ["ZH-S", "zh-Hans-CN"],
    ["ZH-T", "zh-Hant-TW"],
    ["NO", "nb-NO"],
    ["JA", "ja-JP"],
    [" FR ", "fr-FR"],
  ])("maps %s to the region-qualified %s v3 stores", (raw, expected) => {
    expect(normalizeQualtricsLanguageCode(raw)).toBe(expected);
  });

  test.each(["XX", "", "KLINGON", "en-", "1234"])("has no equivalent for %j", (raw) => {
    expect(normalizeQualtricsLanguageCode(raw)).toBeNull();
  });

  test.each(["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"])(
    "refuses %s before any table lookup",
    (raw) => {
      expect(normalizeQualtricsLanguageCode(raw)).toBeNull();
    }
  );

  test("refuses a long string without scanning it", () => {
    expect(normalizeQualtricsLanguageCode(`EN-${"A".repeat(10_000)}`)).toBeNull();
  });
});

describe("isReportableLanguageCode", () => {
  test("names a code in a report only when it looks like one", () => {
    expect(isReportableLanguageCode("XX")).toBe(true);
    expect(isReportableLanguageCode("__proto__")).toBe(false);
    expect(isReportableLanguageCode("x".repeat(100))).toBe(false);
  });
});
