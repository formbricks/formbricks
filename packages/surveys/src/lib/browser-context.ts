import { type TResponseUpdate, normalizeCountryCode } from "@formbricks/types/responses";
import type { TVisitSnapshot } from "@formbricks/types/show-conditions";
import { type TVisitUtm, UTM_PARAMS, VISIT_URLS_SEPARATOR, readUtmParams } from "@formbricks/types/visit";

/**
 * The `meta` the renderer contributes to a response: the browser-runtime context it can observe,
 * plus the two fields it already sent (`url`, `source`). `action` is added by the caller, because
 * only the survey component knows which trigger opened it.
 */
export type TWebSurveyMeta = NonNullable<TResponseUpdate["meta"]>;

/**
 * Every read below is individually guarded, and that is the whole point rather than defensive
 * habit. This runs inside a customer's page on whatever engine they brought — an embedded WebView,
 * a locked-down kiosk browser, a jsdom-based test harness, a privacy build that has deleted
 * `Intl` — and the renderer is mid-render when it runs. A single `TypeError` here would take the
 * survey down with it, trading a whole response for one optional analytics field. So a read that
 * cannot complete yields an **absent key**, never a throw and never a placeholder value.
 *
 * "Absent" is also the honest encoding. An empty `document.referrer` means "arrived directly", not
 * "referrer is the empty string", and storing `""` would make the two indistinguishable to every
 * downstream reader — filters, exports, recall. Same for a `utm_source=` with no value.
 */
const readString = (read: () => string | null | undefined): string | undefined => {
  try {
    const value = read();
    // Trim before testing: a `?utm_source=%20` is noise, not a campaign.
    const trimmed = typeof value === "string" ? value.trim() : "";
    return trimmed === "" ? undefined : trimmed;
  } catch {
    return undefined;
  }
};

/**
 * Only finite, positive dimensions are kept. A `0` viewport is what a hidden or not-yet-laid-out
 * document reports, and recording it would look like a real measurement of a zero-pixel screen.
 */
const readDimension = (read: () => number | null | undefined): number | undefined => {
  try {
    const value = read();
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
    return Math.round(value);
  } catch {
    return undefined;
  }
};

/** A count or a duration. Unlike a dimension, `0` is a real reading here (no time on site yet). */
const readCount = (read: () => number | null | undefined): number | undefined => {
  try {
    const value = read();
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
    return Math.round(value);
  } catch {
    return undefined;
  }
};

/** Drops the keys that resolved to `undefined` so they are absent from the JSON, not present-and-null. */
const compact = (meta: Record<string, string | number | undefined>): TWebSurveyMeta =>
  Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== undefined));

/**
 * The **page** group: everything whose meaning comes from `location` describing a host page the
 * respondent navigated to. Gated on `isWebEnvironment` — see {@link createWebSurveyMetaSnapshot}.
 *
 * Reads the runtime **once**, at the moment it is called. Nothing here caches, so calling it twice
 * really does re-measure, which is precisely the bug the snapshot exists to prevent.
 */
export const readPageContextMeta = (): TWebSurveyMeta => {
  const searchParams = (() => {
    try {
      return new URL(window.location.href).searchParams;
    } catch {
      return undefined;
    }
  })();

  return compact({
    // `url` and `source` predate this snapshot and keep their existing meaning; they are captured
    // here so the *whole* client-side meta is frozen together at display, rather than half of it
    // being re-read on every submit.
    url: readString(() => window.location.href),
    source: readString(() => searchParams?.get("source")),
    pagePath: readString(() => window.location.pathname),
    pageReferrer: readString(() => document.referrer),
    // The same rule the web SDK keeps the landing campaign by: trimmed, and an empty value is absent.
    ...readUtmParams(searchParams?.toString() ?? ""),
  });
};

/**
 * The **device** group: measurements of the machine and of the area the survey was rendered into,
 * plus how that machine is configured. Read in every runtime, on and off the web — see
 * {@link createWebSurveyMetaSnapshot} for why the two groups are gated differently.
 *
 * Same single-read rule as {@link readPageContextMeta}.
 */
export const readDeviceContextMeta = (): TWebSurveyMeta =>
  compact({
    screenWidth: readDimension(() => window.screen.width),
    screenHeight: readDimension(() => window.screen.height),
    viewportWidth: readDimension(() => window.innerWidth),
    viewportHeight: readDimension(() => window.innerHeight),
    timezone: readString(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    // The device's configured locale (`de-AT`), not the language the respondent is *answering* in —
    // that is `language`, resolved from the survey's own language switch. A German speaker taking an
    // English-only survey has `locale: "de-DE"` and `language: "en"`, and the pair is the finding.
    locale: readString(() => navigator.language),
  });

/**
 * The **visit** group (ENG-3926). Handed in by the web SDK instead of read here, because only js-core
 * keeps the visit, in sessionStorage across page loads. Absent when nothing was handed in: a link
 * survey, a mobile app, or an SDK that predates it. Read as defensively as the groups above, since
 * the SDK and this renderer are cached separately and may not be the same version.
 */
const readVisitContextMeta = (visit: TVisitSnapshot | undefined): TWebSurveyMeta => {
  if (!visit) return {};
  return compact({
    visitPagesViewed: readCount(() => visit.pagesViewed),
    visitUniquePagesViewed: readCount(() => visit.uniquePagesViewed),
    visitTimeOnSite: readCount(() => visit.timeOnSite),
    visitEntryReferrer: readString(() => visit.entryReferrer),
    visitUrls: readString(() => visit.visitedUrls.join(VISIT_URLS_SEPARATOR)),
  });
};

const readRawCountry = (
  hiddenFieldsRecord: Record<string, unknown> | undefined,
  isLinkSurvey: boolean
): unknown => {
  const bagKey = Object.keys(hiddenFieldsRecord ?? {}).find((key) => key.toLowerCase() === "country");
  if (bagKey !== undefined) return hiddenFieldsRecord?.[bagKey];
  if (!isLinkSurvey) return undefined;
  return readString(() => new URL(window.location.href).searchParams.get("country"));
};

/**
 * The respondent's country, when the host set it explicitly — for surveys behind no CDN that reports
 * one, or when the host simply knows better than an IP guess. The ingest routes prefer it over the CDN
 * header. Two inputs, checked in this order:
 *
 * - `country` in the bag the host handed over (`setEmbeddedData`, `track({ hiddenFields })`, the mobile
 *   SDKs), matched case-insensitively like every other bag key.
 * - On a link survey, `?country=` on the survey's own URL. Only there: an app survey's page URL is the
 *   customer's page, where `?country=` may well be a shop filter rather than a statement about the
 *   respondent.
 *
 * Only a two-letter ISO code is kept (`DE`, `us` → `US`). Anything else is dropped with a warning, so
 * the CDN value still applies and the developer learns why theirs did not.
 *
 * A survey that declares its own `country` field, or a question with that id, keeps the name: the value
 * fills that field as before (say, a target market rather than where the respondent is), so it must not
 * also become the respondent's country. `shadowingNames` is `listShadowingNames` for the survey.
 */
export const readExplicitCountry = ({
  hiddenFieldsRecord,
  isLinkSurvey,
  shadowingNames,
}: {
  hiddenFieldsRecord: Record<string, unknown> | undefined;
  isLinkSurvey: boolean;
  shadowingNames: readonly string[];
}): string | undefined => {
  if (shadowingNames.some((name) => name.toLowerCase() === "country")) return undefined;

  const raw = readRawCountry(hiddenFieldsRecord, isLinkSurvey);
  if (raw === undefined || raw === null) return undefined;

  const country = normalizeCountryCode(raw);
  if (country === undefined) {
    console.warn(
      `Formbricks: "country" must be a two-letter country code such as "DE", so ${JSON.stringify(raw)} was ignored.`
    );
  }
  return country;
};

const hasUtm = (meta: TWebSurveyMeta): boolean => UTM_PARAMS.some(([, key]) => meta[key] !== undefined);

/**
 * The campaign the visit arrived with (ENG-7430), kept by the web SDK because the page the survey
 * shows on is often not the one the visitor landed on. Only the five UTM keys are read, each as
 * defensively as the rest: the SDK and this renderer are cached separately, so `visit.utm` may be
 * missing (an older SDK) or not the shape this version expects.
 */
const readVisitUtmMeta = (visit: TVisitSnapshot | undefined): TWebSurveyMeta => {
  const utm: TVisitUtm = {};
  for (const [, key] of UTM_PARAMS) {
    utm[key] = readString(() => visit?.utm?.[key]);
  }
  return compact(utm);
};

/**
 * The page group, with the visit's campaign standing in when the page itself carries none.
 *
 * The page's own UTM parameters win as a whole set, so a response never mixes two campaigns and a
 * survey on a tagged page records exactly what it did before. Only a page without any falls back to
 * the visit's, which is how a visitor who landed with `?utm_campaign=…` and answers two pages later
 * still has the campaign on the response. `url` and `pagePath` stay the page the survey shows on.
 */
const readAttributedPageContextMeta = (visit: TVisitSnapshot | undefined): TWebSurveyMeta => {
  const page = readPageContextMeta();
  return hasUtm(page) ? page : { ...page, ...readVisitUtmMeta(visit) };
};

/**
 * **Snapshot at display, then freeze.**
 *
 * Takes one reading of the runtime and hands back a getter that returns that same reading for the
 * rest of the survey's life. A respondent who rotates a phone, opens a devtools panel, or resizes
 * the window between question three and submit must not retroactively rewrite the viewport the
 * response was answered at; whatever the first card was rendered into is what the response records.
 *
 * The getter returns the very same object every time, so the freeze is observable by identity as
 * well as by value — see browser-context.test.ts, which mutates `window.innerWidth` between two
 * calls and asserts the second reading is unchanged.
 *
 * **`isWebEnvironment` gates the page group only, and that is the whole meaning of the flag.** It
 * asks "does this runtime's `location` describe a host page?", not "is this a browser". A mobile
 * SDK's WebView answers no — all four load their HTML with a null base URL, so `location.href` is
 * `about:blank` and `document.referrer` is `""`; reporting the renderer's own address as the page
 * the survey was shown on would be an answer that looks valid and means nothing. But that same
 * WebView has a real screen, a real viewport and a real `Intl` zone, so the device group is read
 * everywhere. That is what gives app surveys the honest half of Tier-1 capture with no SDK release
 * and no customer app rebuild (ENG-2472) — the renderer is loaded un-pinned from
 * `{appUrl}/js/surveys.umd.cjs` by every installed app.
 *
 * Off the runtime entirely (SSR, a test harness with no `window`) every individual read is guarded
 * and yields an absent key, so the snapshot degrades to `{}` rather than throwing.
 */
export const createWebSurveyMetaSnapshot = (
  isWebEnvironment: boolean,
  visit?: TVisitSnapshot,
  country?: string
): (() => TWebSurveyMeta) => {
  const snapshot: TWebSurveyMeta = {
    ...(isWebEnvironment ? readAttributedPageContextMeta(visit) : {}),
    ...readDeviceContextMeta(),
    ...readVisitContextMeta(visit),
    // From `readExplicitCountry`, frozen with the rest: the host's value at display is the answer.
    ...(country === undefined ? {} : { country }),
  };
  return () => snapshot;
};
