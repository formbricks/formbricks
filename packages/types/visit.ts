// Kept free of zod on purpose: the survey renderer imports this at runtime, and a value import from a
// module that builds zod schemas would pull zod into every visitor's bundle.

/**
 * Joins the paths stored in a response's `visitUrls`. A browser percent-encodes spaces in a path, so
 * the separator cannot occur inside one, and splitting on it gives the paths back exactly.
 */
export const VISIT_URLS_SEPARATOR = " · ";

/**
 * The campaign parameters a website survey reads, and the response `meta` key each one is saved as.
 * Shared by the renderer, which reads them from the page the survey shows on, and the web SDK, which
 * keeps the ones the visit arrived with (ENG-7430).
 */
export const UTM_PARAMS = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_term", "utmTerm"],
  ["utm_content", "utmContent"],
] as const;

export type TVisitUtmKey = (typeof UTM_PARAMS)[number][1];

/** A visit's campaign attribution: only the parameters that carried a value, never an empty one. */
export type TVisitUtm = Partial<Record<TVisitUtmKey, string>>;

/**
 * Reads the UTM parameters of a query string (`?utm_campaign=…`). A value is trimmed and dropped
 * when empty, so `utm_source=` is no campaign. `undefined` when no parameter carried a value: a page
 * without a campaign has no attribution, not an empty one.
 */
export const readUtmParams = (search: string): TVisitUtm | undefined => {
  const params = new URLSearchParams(search);
  const utm: TVisitUtm = {};
  for (const [param, key] of UTM_PARAMS) {
    const value = params.get(param)?.trim();
    if (value) utm[key] = value;
  }
  return Object.keys(utm).length > 0 ? utm : undefined;
};
