import type { TResponseUpdate } from "@formbricks/types/responses";

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

/** Drops the keys that resolved to `undefined` so they are absent from the JSON, not present-and-null. */
const compact = (meta: Record<string, string | number | undefined>): TWebSurveyMeta =>
  Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== undefined));

const UTM_PARAMS = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_term", "utmTerm"],
  ["utm_content", "utmContent"],
] as const;

/**
 * Reads the browser-runtime context **once**, at the moment it is called.
 *
 * Callers must call this exactly once per survey display and reuse the result — see
 * `createWebSurveyMetaSnapshot`, which is the only intended entry point. Nothing here caches, so
 * calling it twice really does re-measure, which is precisely the bug the snapshot exists to prevent.
 */
export const readBrowserContextMeta = (): TWebSurveyMeta => {
  const searchParams = (() => {
    try {
      return new URL(window.location.href).searchParams;
    } catch {
      return undefined;
    }
  })();

  const utm: Record<string, string | undefined> = {};
  for (const [param, key] of UTM_PARAMS) {
    utm[key] = readString(() => searchParams?.get(param));
  }

  return compact({
    // `url` and `source` predate this snapshot and keep their existing meaning; they are captured
    // here so the *whole* client-side meta is frozen together at display, rather than half of it
    // being re-read on every submit.
    url: readString(() => window.location.href),
    source: readString(() => searchParams?.get("source")),
    pageUrl: readString(() => window.location.href),
    pagePath: readString(() => window.location.pathname),
    pageReferrer: readString(() => document.referrer),
    ...utm,
    screenWidth: readDimension(() => window.screen.width),
    screenHeight: readDimension(() => window.screen.height),
    viewportWidth: readDimension(() => window.innerWidth),
    viewportHeight: readDimension(() => window.innerHeight),
    timezone: readString(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
  });
};

/**
 * **Snapshot at display, then freeze.**
 *
 * Takes one reading of the browser runtime and hands back a getter that returns that same reading
 * for the rest of the survey's life. A respondent who rotates a phone, opens a devtools panel, or
 * resizes the window between question three and submit must not retroactively rewrite the viewport
 * the response was answered at; whatever the first card was rendered into is what the response
 * records.
 *
 * The getter returns the very same object every time, so the freeze is observable by identity as
 * well as by value — see browser-context.test.ts, which mutates `window.innerWidth` between two
 * calls and asserts the second reading is unchanged.
 *
 * Off the web (React Native, SSR) there is no runtime to read and the snapshot is simply empty.
 */
export const createWebSurveyMetaSnapshot = (isWebEnvironment: boolean): (() => TWebSurveyMeta) => {
  const snapshot: TWebSurveyMeta = isWebEnvironment ? readBrowserContextMeta() : {};
  return () => snapshot;
};
