import { matchDeclaredFieldName } from "@formbricks/types/safe-identifier";
import { FORBIDDEN_IDS } from "@formbricks/types/surveys/validation";

/**
 * Link-survey params that drive the runtime rather than carrying response data, and which
 * `FORBIDDEN_IDS` does not already cover. Lowercase because they are compared against a lowercased
 * param key. `suToken` in particular is a credential, and the rest would silently capture UI state.
 */
const LINK_SURVEY_SYSTEM_PARAMS = [
  "sutoken",
  "lang",
  "preview",
  "startat",
  "skipprefilled",
  "offlinesupport",
];

/**
 * Param keys that must never be captured as a hidden field answer, in any casing. Derived from
 * `FORBIDDEN_IDS` so the reserved list cannot drift away from the survey schema's own.
 */
const RESERVED_PARAM_KEYS = new Set([
  ...FORBIDDEN_IDS.map((forbiddenId) => forbiddenId.toLowerCase()),
  ...LINK_SURVEY_SYSTEM_PARAMS,
]);

type TSearchParamsWithKeys = Pick<URLSearchParams, "keys" | "get">;

/**
 * Reads the survey's declared hidden fields out of the URL, tolerating case drift in the query
 * string: a survey declaring `CustomerRef` is filled by `?customerref=x` as well as `?CustomerRef=x`.
 *
 * The record is always keyed by the declared name, so downstream consumers only ever see the
 * spelling the survey defines. Reserved params are never captured, whatever their casing.
 */
export const getHiddenFieldsFromSearchParams = (
  declaredFieldIds: string[],
  searchParams: TSearchParamsWithKeys
): Record<string, string> => {
  const fieldsRecord: Record<string, string> = {};
  const incomingParamKeys = Array.from(searchParams.keys());

  for (const declaredFieldId of declaredFieldIds) {
    // Resolved against the param keys rather than the other way round so an exactly matching
    // param always beats a case-insensitive one, whatever order they appear in the URL.
    const matchedParamKey = matchDeclaredFieldName(incomingParamKeys, declaredFieldId);
    if (matchedParamKey === undefined) continue;

    // `ZSurveyHiddenFields` rejects reserved names case-sensitively, so a survey can legally declare
    // `Verify` or `UserId`. Matching case-insensitively here would turn that into a way to capture
    // reserved params - most seriously `?verify=<jwt>`, the email-verification credential read by
    // `verify-email-gate.ts`, which would then be written to the response and every export.
    // Checked on the resolved param key so no casing on either side gets through.
    if (RESERVED_PARAM_KEYS.has(matchedParamKey.toLowerCase())) continue;

    const answer = searchParams.get(matchedParamKey);
    if (answer) fieldsRecord[declaredFieldId] = answer;
  }

  return fieldsRecord;
};
