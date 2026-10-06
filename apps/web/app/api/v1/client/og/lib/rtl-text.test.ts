import { describe, expect, test } from "vitest";
import { isRtlText } from "./rtl-text";

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
