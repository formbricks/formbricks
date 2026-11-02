import { describe, expect, test } from "vitest";
import { matchLanguage } from "@formbricks/creatives";
import {
  type TMatchableSurveyLanguage,
  matchSurveyLanguage,
} from "@formbricks/i18n-utils/survey-language-match";
import { buildLanguageMatch } from "./language-match";

const language = (
  code: string,
  { isDefault = false, enabled = true, alias = null as string | null } = {}
): TMatchableSurveyLanguage => ({ default: isDefault, enabled, language: { code, alias } });

/** Language lists a creative or its survey can have, each with something the matcher's tiers decide. */
const LISTS: Record<string, TMatchableSurveyLanguage[]> = {
  "English and German with an alias": [
    language("en-US", { isDefault: true }),
    language("de-DE", { alias: "german" }),
  ],
  "a legacy code beside its canonical sibling": [
    language("en-US", { isDefault: true }),
    language("de"),
    language("de-DE"),
  ],
  "only a legacy code": [language("en", { isDefault: true }), language("pt")],
  "both Chinese scripts": [
    language("en-US", { isDefault: true }),
    language("zh-Hans-CN"),
    language("zh-Hant-TW"),
  ],
  "two Portuguese and two Arabic regions": [
    language("pt-PT", { isDefault: true }),
    language("pt-BR"),
    language("ar-SA"),
    language("ar-EG"),
  ],
  "a disabled language": [language("en-US", { isDefault: true }), language("fr-FR", { enabled: false })],
  "a default that is a regional variant": [language("es-MX", { isDefault: true }), language("en-GB")],
  "renamed and macro languages": [
    language("he-IL", { isDefault: true }),
    language("nb-NO"),
    language("sr-RS"),
    language("tl", { alias: "filipino" }),
  ],
};

/** What visitors and sites send: codes in every spelling, regions, scripts, weights, aliases and noise. */
// prettier-ignore
const REQUESTS = [
  "en-US", "en", "EN_us", "en-GB", "en-AU", "en;q=0.9", " en-US ",
  "de-DE", "de", "DE-de", "de_DE", "de-AT", "de-CH", "deu", "german", "German", "de-Latn-DE",
  "pt", "pt-BR", "pt-PT", "pt-AO", "pt-br",
  "zh", "zh-CN", "zh-SG", "zh-Hans", "zh-TW", "zh-HK", "zh-MO", "zh-Hant", "zh-Hant-TW", "zh-Hans-CN",
  "ar", "ar-MA", "ar-SA", "ar-EG", "ar-AE",
  "es", "es-MX", "es-ES", "es-419",
  "fr-FR", "fr", "fr-CA",
  "iw", "he-IL", "he", "nb", "no", "nn", "sr", "sr-Latn", "sr-Cyrl-RS", "tl", "fil", "Filipino",
  "x", "1234", "constructor", "__proto__", "toString", "",
];

describe("buildLanguageMatch", () => {
  test.each(Object.entries(LISTS))(
    "answers on the page what the full matcher answers, for every request (%s)",
    (_name, languages) => {
      const match = buildLanguageMatch(languages);

      for (const request of REQUESTS) {
        expect([request, matchLanguage(match, request)]).toEqual([
          request,
          matchSurveyLanguage(languages, request),
        ]);
      }
    }
  );

  test("sends nothing to match for a single language, which is always the one shown", () => {
    expect(buildLanguageMatch([language("en-US", { isDefault: true })])).toEqual({ keys: {}, bases: {} });
  });
});
