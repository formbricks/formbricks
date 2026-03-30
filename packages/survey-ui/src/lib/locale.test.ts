import { ar, de, enUS, es, fr, hi, it, ja, nl, pt, ptBR, ro, ru, uz, zhCN, zhTW } from "date-fns/locale";
import { describe, expect, test } from "vitest";
import { getDateFnsLocale } from "./locale";

describe("getDateFnsLocale", () => {
  test("returns enUS when localeCode is undefined", () => {
    expect(getDateFnsLocale()).toBe(enUS);
  });

  test("returns enUS when localeCode is empty string", () => {
    expect(getDateFnsLocale("")).toBe(enUS);
  });

  test("handles English locales", () => {
    expect(getDateFnsLocale("en")).toBe(enUS);
    expect(getDateFnsLocale("en-US")).toBe(enUS);
    expect(getDateFnsLocale("EN-US")).toBe(enUS);
  });

  test("handles German locales", () => {
    expect(getDateFnsLocale("de")).toBe(de);
    expect(getDateFnsLocale("de-DE")).toBe(de);
    expect(getDateFnsLocale("DE")).toBe(de);
  });

  test("handles Spanish locales", () => {
    expect(getDateFnsLocale("es")).toBe(es);
    expect(getDateFnsLocale("es-ES")).toBe(es);
  });

  test("handles French locales", () => {
    expect(getDateFnsLocale("fr")).toBe(fr);
    expect(getDateFnsLocale("fr-FR")).toBe(fr);
  });

  test("handles Japanese locales", () => {
    expect(getDateFnsLocale("ja")).toBe(ja);
    expect(getDateFnsLocale("ja-JP")).toBe(ja);
  });

  test("handles Dutch locales", () => {
    expect(getDateFnsLocale("nl")).toBe(nl);
    expect(getDateFnsLocale("nl-NL")).toBe(nl);
  });

  test("handles Portuguese locales - Brazilian", () => {
    expect(getDateFnsLocale("pt")).toBe(ptBR);
    expect(getDateFnsLocale("pt-BR")).toBe(ptBR);
    expect(getDateFnsLocale("pt-br")).toBe(ptBR);
  });

  test("handles Portuguese locales - Portugal", () => {
    expect(getDateFnsLocale("pt-PT")).toBe(pt);
    expect(getDateFnsLocale("pt-pt")).toBe(pt);
  });

  test("handles Romanian locales", () => {
    expect(getDateFnsLocale("ro")).toBe(ro);
    expect(getDateFnsLocale("ro-RO")).toBe(ro);
  });

  test("handles Arabic locales", () => {
    expect(getDateFnsLocale("ar")).toBe(ar);
    expect(getDateFnsLocale("ar-SA")).toBe(ar);
  });

  test("handles Italian locales", () => {
    expect(getDateFnsLocale("it")).toBe(it);
    expect(getDateFnsLocale("it-IT")).toBe(it);
  });

  test("handles Russian locales", () => {
    expect(getDateFnsLocale("ru")).toBe(ru);
    expect(getDateFnsLocale("ru-RU")).toBe(ru);
  });

  test("handles Uzbek locales", () => {
    expect(getDateFnsLocale("uz")).toBe(uz);
    expect(getDateFnsLocale("uz-UZ")).toBe(uz);
  });

  test("handles Hindi locales", () => {
    expect(getDateFnsLocale("hi")).toBe(hi);
    expect(getDateFnsLocale("hi-IN")).toBe(hi);
  });

  test("handles Chinese Simplified locales", () => {
    expect(getDateFnsLocale("zh")).toBe(zhCN);
    expect(getDateFnsLocale("zh-Hans")).toBe(zhCN);
    expect(getDateFnsLocale("zh-hans")).toBe(zhCN);
    expect(getDateFnsLocale("zh-CN")).toBe(zhCN);
    expect(getDateFnsLocale("zh-cn")).toBe(zhCN);
  });

  test("handles Chinese Traditional locales", () => {
    expect(getDateFnsLocale("zh-Hant")).toBe(zhTW);
    expect(getDateFnsLocale("zh-hant")).toBe(zhTW);
    expect(getDateFnsLocale("zh-TW")).toBe(zhTW);
    expect(getDateFnsLocale("zh-tw")).toBe(zhTW);
    expect(getDateFnsLocale("zh-HK")).toBe(zhTW);
    expect(getDateFnsLocale("zh-hk")).toBe(zhTW);
  });

  test("returns enUS for unknown locale codes", () => {
    expect(getDateFnsLocale("unknown")).toBe(enUS);
    expect(getDateFnsLocale("xx-XX")).toBe(enUS);
  });

  test("handles case-insensitive locale codes", () => {
    expect(getDateFnsLocale("FR")).toBe(fr);
    expect(getDateFnsLocale("Fr-Fr")).toBe(fr);
  });
});
