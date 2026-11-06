import { describe, expect, test } from "vitest";
import deDE from "@/locales/de-DE.json";
import enUS from "@/locales/en-US.json";
import esES from "@/locales/es-ES.json";
import zhHantTW from "@/locales/zh-Hant-TW.json";
import { getDefaultEndingTexts } from "./default-ending";

const endingOf = (messages: {
  templates: { default_ending_card_headline: string; default_ending_card_subheader: string };
}) => ({
  headline: messages.templates.default_ending_card_headline,
  subheader: messages.templates.default_ending_card_subheader,
});

describe("getDefaultEndingTexts", () => {
  test("reads each language's strings, a regional variant from its language's", async () => {
    expect(await getDefaultEndingTexts(["en-US", "de-AT", "es-419", "zh-Hant-HK"])).toEqual([
      endingOf(enUS),
      endingOf(deDE),
      endingOf(esES),
      endingOf(zhHantTW),
    ]);
  });

  test("gives a language with no strings nothing, unless it is the default one", async () => {
    expect(await getDefaultEndingTexts(["it-IT", "nb-NO"])).toEqual([endingOf(enUS), null]);
  });
});
