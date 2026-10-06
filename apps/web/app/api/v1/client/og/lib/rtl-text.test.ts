import { describe, expect, test } from "vitest";
import { getCardTitle, isRtlText } from "./rtl-text";

describe("isRtlText", () => {
  test.each([
    ["arabic", "استبياني"],
    ["arabic with lam+alef", "أهلا"],
    ["hebrew", "הסקר שלי"],
    ["thaana", "ސަރވޭ"],
    ["arabic mixed into a latin name", "Customer Survey | استبيان"],
  ])("detects %s", (_label, value) => {
    expect(isRtlText(value)).toBe(true);
  });

  test.each([
    ["missing", null],
    ["empty", ""],
    ["latin", "Customer Satisfaction Survey"],
    ["latin with accents", "Enquête de satisfaction"],
    ["cyrillic", "мой опрос"],
    ["chinese", "我的调查问卷"],
    ["devanagari", "मेरा सर्वेक्षण"],
    ["digits and punctuation only", "2026 — Q4 (v2)"],
  ])("leaves %s alone", (_label, value) => {
    expect(isRtlText(value)).toBe(false);
  });
});

describe("getCardTitle", () => {
  test.each([
    ["the Cloud brand suffix", "استبيان رضا العملاء | Formbricks", "Formbricks"],
    ["a left-to-right segment before an RTL one", "Customer Survey | استبيان", "Customer Survey"],
    ["every left-to-right segment", "Q4 | استبيان | Formbricks", "Q4 | Formbricks"],
    ["a left-to-right name untouched", "Survey | Formbricks", "Survey | Formbricks"],
  ])("keeps %s", (_label, name, expected) => {
    expect(getCardTitle(name)).toBe(expected);
  });

  test.each([
    ["a self-hosted RTL name", "استبيان رضا العملاء"],
    ["an RTL segment mixed with Latin", "Survey استبيان"],
    ["only RTL segments", "أهلا | שלום"],
    ["a missing name", null],
    ["an empty name", ""],
  ])("returns null for %s", (_label, name) => {
    expect(getCardTitle(name)).toBeNull();
  });
});
