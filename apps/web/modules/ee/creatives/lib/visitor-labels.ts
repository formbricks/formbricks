import "server-only";
import type { TBannerPayload } from "@formbricks/creatives";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";
import { resolveSurveyLanguageDefaultTag } from "@formbricks/i18n-utils/survey-runtime-languages";
import { type TUserLocale, ZUserLocale } from "@formbricks/types/user";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";

/**
 * The words a banner shows visitors that its author doesn't write (ENG-4003): the region's default
 * Accessible name and the Dismiss control's name. The server fills them in for each of the banner's
 * languages, so the SDK ships no translations and names both in the language the texts show in.
 */

type TLabels = { siteNotice: string; dismiss: string };

/**
 * The dashboard locale (`apps/web/locales`) whose words a language gets: the same code, its canonical
 * form (`de` → `de-DE`) or its language's default tag (`de-AT` → `de-DE`, `zh-TW` → `zh-Hant-TW`). The
 * dashboard covers fewer languages than the survey runtime, so the rest get English.
 */
export const toLabelLocale = (code: string): TUserLocale => {
  for (const candidate of [code, normalizeLanguageCode(code), resolveSurveyLanguageDefaultTag(code)]) {
    const locale = ZUserLocale.safeParse(candidate);
    if (locale.success) return locale.data;
  }
  return DEFAULT_LOCALE;
};

const loadLabels = async (locale: TUserLocale): Promise<TLabels> => {
  // A word Lingo.dev hasn't translated yet shows in English (the translator's fallback locale).
  const t = await getTranslate(locale);
  return {
    siteNotice: t("workspace.creatives.visitor_site_notice"),
    dismiss: t("workspace.creatives.visitor_dismiss"),
  };
};

/** Per process: the environment payload is rebuilt every minute per workspace, the words never change. */
const labelsByLocale = new Map<TUserLocale, Promise<TLabels>>();

const getLabels = (locale: TUserLocale): Promise<TLabels> => {
  let labels = labelsByLocale.get(locale);
  if (!labels) {
    labels = loadLabels(locale);
    labelsByLocale.set(locale, labels);
    // A failed load is tried again on the next payload instead of being remembered.
    void labels.catch(() => labelsByLocale.delete(locale));
  }
  return labels;
};

/** A banner's `labels`: both words in each of its language codes. */
export const getBannerLabels = async (codes: readonly string[]): Promise<TBannerPayload["labels"]> => {
  const entries = await Promise.all(
    codes.map(async (code) => [code, await getLabels(toLabelLocale(code))] as const)
  );
  return {
    siteNotice: Object.fromEntries(entries.map(([code, labels]) => [code, labels.siteNotice])),
    dismiss: Object.fromEntries(entries.map(([code, labels]) => [code, labels.dismiss])),
  };
};
