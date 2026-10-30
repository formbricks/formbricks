// The link survey's own URL params and the declared-field names they reserve. Kept apart from
// `validation.ts`, which imports an HTML parser, so the respondent link page can read these without
// shipping that parser; `validation.ts` re-exports them for every existing import.

export const FORBIDDEN_IDS = [
  "userId",
  "source",
  "suid",
  "end",
  "start",
  "welcomeCard",
  "hidden",
  "verifiedEmail",
  "multiLanguage",
  "embed",
  "verify",
];

/**
 * Link-survey params that drive the runtime rather than carrying response data, spelled exactly as
 * the link survey reads them (`page.tsx`, `survey-renderer.tsx`, `survey-client-wrapper.tsx`).
 * `suId`/`suToken` are the single-use credential pair, and the rest would silently capture UI state.
 * `suId` is listed although `FORBIDDEN_IDS` holds `suid`: the exact-spelling set below needs the
 * casing the runtime actually reads.
 */
export const LINK_SURVEY_SYSTEM_PARAMS = [
  "suId",
  "suToken",
  "lang",
  "preview",
  "startAt",
  "skipPrefilled",
  "offlineSupport",
];

/**
 * The exact spellings under which the link survey reads its own URL params: `FORBIDDEN_IDS` plus
 * `LINK_SURVEY_SYSTEM_PARAMS`, case preserved. `getHiddenFieldsFromSearchParams` never fills a
 * hidden field declared under one of these, whatever casing the param arrives in — the param IS the
 * system param (`?lang=` is the language switch, not data).
 */
export const LINK_SURVEY_SYSTEM_PARAM_KEYS = new Set([...FORBIDDEN_IDS, ...LINK_SURVEY_SYSTEM_PARAMS]);

/**
 * Every name a declared field must never take, lowercased. The single source of truth shared by the
 * two ends that have to agree: `validateId` refuses to create such a name in any casing, and
 * `getHiddenFieldsFromSearchParams` refuses to fill a field from a param that matches it only
 * case-insensitively (`Verify` from `?verify=`). A field a survey already declares under a case
 * variant keeps being filled by that exact spelling (`Source` from `?Source=`) — the grandfather
 * rule, and the reason this set gates the case-insensitive path only.
 */
export const RESERVED_DECLARED_FIELD_NAMES = new Set(
  [...LINK_SURVEY_SYSTEM_PARAM_KEYS].map((key) => key.toLowerCase())
);
