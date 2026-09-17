import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { INFORMAL_ADDRESS_PATTERNS, findInformalAddress } from "./locale-register";

const deDE = INFORMAL_ADDRESS_PATTERNS["de-DE"]!;
const ruRU = INFORMAL_ADDRESS_PATTERNS["ru-RU"]!;

describe("findInformalAddress", () => {
  test("flags informal second-person forms and names the key they sit under", () => {
    const bundle = {
      common: { select_option: "Wähle eine Option" },
      errors: { recaptcha_error: { title: "Wir konnten nicht verifizieren, dass du ein Mensch bist." } },
    };

    expect(findInformalAddress(bundle, deDE)).toEqual([
      { key: "common.select_option", value: "Wähle eine Option", match: "Wähle" },
      {
        key: "errors.recaptcha_error.title",
        value: "Wir konnten nicht verifizieren, dass du ein Mensch bist.",
        match: "du",
      },
    ]);
    expect(findInformalAddress({ common: { select_option: "Выбери вариант" } }, ruRU)).toEqual([
      { key: "common.select_option", value: "Выбери вариант", match: "Выбери" },
    ]);
    expect(findInformalAddress({ answer: "Введите твою фамилию" }, ruRU)).toEqual([
      { key: "answer", value: "Введите твою фамилию", match: "твою" },
    ]);
  });

  // JS `\b` only knows ASCII word characters, so "варианты" would end in a false "ты" without the
  // Unicode-aware boundary; "Individuell" is the Latin counterpart.
  test("passes formal and register-neutral phrasing, and words that merely contain an informal form", () => {
    const bundle = {
      select_option: "Option wählen",
      is_between: "Bitte wählen Sie ein Datum zwischen {startDate} und {endDate}",
      redirected: "Sie werden sofort weitergeleitet",
      plural: "{count, plural, one {Dauert 1 Minute} other {Dauert {count} Minuten}}",
      lookalikes: "Individuell für Kundinnen",
    };

    expect(findInformalAddress(bundle, deDE)).toEqual([]);
    expect(findInformalAddress({ a: "Выберите варианты", b: "Пожалуйста, введите" }, ruRU)).toEqual([]);
  });
});

// The bundles are regenerated from English by Lingo.dev, which has no register to preserve; this is what
// keeps a regenerated string from re-introducing "du" (ENG-2790). Every language with a pattern is
// checked, so adding a language means adding its pattern and nothing here.
describe("shipped bundles address the respondent formally", () => {
  test.each(Object.entries(INFORMAL_ADDRESS_PATTERNS))("%s", (code, pattern) => {
    const bundle: unknown = JSON.parse(
      readFileSync(new URL(`../../locales/${code}.json`, import.meta.url), "utf8")
    );

    expect(findInformalAddress(bundle, pattern)).toEqual([]);
  });
});
