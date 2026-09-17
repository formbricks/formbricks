import { describe, expect, test } from "vitest";
import deDETranslations from "../../locales/de-DE.json";
import ruRUTranslations from "../../locales/ru-RU.json";
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
  });

  test("passes formal and register-neutral phrasing", () => {
    const bundle = {
      select_option: "Option wählen",
      is_between: "Bitte wählen Sie ein Datum zwischen {startDate} und {endDate}",
      redirected: "Sie werden sofort weitergeleitet",
      plural: "{count, plural, one {Dauert 1 Minute} other {Dauert {count} Minuten}}",
    };

    expect(findInformalAddress(bundle, deDE)).toEqual([]);
    expect(findInformalAddress({ select_option: "Выберите вариант" }, ruRU)).toEqual([]);
  });

  test("matches whole words only, in Latin and Cyrillic script", () => {
    expect(findInformalAddress({ a: "Individuell", b: "Kundin", c: "Ihre Antwort" }, deDE)).toEqual([]);
    expect(findInformalAddress({ a: "Выберите варианты", b: "Пожалуйста, введите" }, ruRU)).toEqual([]);
  });
});

// The bundles are regenerated from English by Lingo.dev, which has no register to preserve; this is what
// keeps a regenerated string from re-introducing "du" (ENG-2790).
describe("shipped bundles address the respondent formally", () => {
  test.each([
    ["de-DE", deDETranslations, deDE],
    ["ru-RU", ruRUTranslations, ruRU],
  ] as const)("%s", (_code, bundle, pattern) => {
    expect(findInformalAddress(bundle, pattern)).toEqual([]);
  });
});
