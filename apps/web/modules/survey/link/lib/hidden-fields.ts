import { matchDeclaredFieldName } from "@formbricks/types/safe-identifier";
import {
  LINK_SURVEY_SYSTEM_PARAM_KEYS,
  RESERVED_DECLARED_FIELD_NAMES,
} from "@formbricks/types/surveys/validation";

type TSearchParamsWithKeys = Pick<URLSearchParams, "keys" | "get">;

/**
 * Both diagnostics below are for the survey author's browser console. This module also runs during
 * SSR (the client component is server-rendered), where the same lines would land in the operator's
 * Next log once per respondent — an audience that can do nothing with them. Capture behavior itself
 * must stay identical on both passes; only the console output is browser-gated.
 */
const isBrowser = (): boolean => globalThis.window !== undefined;

/**
 * Why `paramKey` may not fill the hidden field `declaredFieldId`, worded for the author's console —
 * or `undefined` when it may.
 *
 * Two refusals, with the grandfather rule between them:
 *
 * 1. The field is named exactly like a param the link survey reads for itself (`lang`, `userId`,
 *    `verify`, `suToken`, …: `LINK_SURVEY_SYSTEM_PARAM_KEYS`). Such a field can never be filled from
 *    the URL, whatever casing the param arrives in, because the param IS the system param.
 *    `ZSurveyHiddenFields` only refuses `FORBIDDEN_IDS`, and case-sensitively, so a stored survey can
 *    hold a `lang` field — `lang` in particular is a name someone would plausibly pick.
 * 2. The param matches the field only case-insensitively and its lowercased key is reserved
 *    (`RESERVED_DECLARED_FIELD_NAMES`): a declared `Verify` matched by `?verify=<jwt>`, the
 *    email-verification credential `verify-email-gate.ts` reads, or a declared `UserId` matched by
 *    `?userId=`. Filling those would turn case-tolerant matching into a way to harvest the survey's
 *    own params, so the match is dropped and the author told which spelling does fill the field.
 *
 * Between the two sits every grandfathered survey: a field declared `Source` filled by `?Source=`,
 * `UserId` by `?UserId=`. The key is byte-for-byte the field's own name, the link survey reads
 * `source` and `userId` rather than those spellings, and filling them is what such surveys relied on
 * before Embedded Data. `userId` is the one param the runtime reads case-insensitively (`user-id.ts`),
 * so `?UserId=` is also the contact lookup — the field then mirrors a value the response already
 * carries, exactly as before.
 */
const getRefusalReason = (declaredFieldId: string, paramKey: string): string | undefined => {
  if (LINK_SURVEY_SYSTEM_PARAM_KEYS.has(declaredFieldId)) {
    return `Formbricks: "${declaredFieldId}" is a link survey URL parameter, so "?${paramKey}=" can never fill a hidden field of that name. Rename the field to collect this value.`;
  }

  if (paramKey === declaredFieldId || !RESERVED_DECLARED_FIELD_NAMES.has(paramKey.toLowerCase())) {
    return undefined;
  }

  return `Formbricks: "?${paramKey}=" is reserved by the link survey URL contract, so it does not fill "${declaredFieldId}" through case-insensitive matching. Only the exact spelling "?${declaredFieldId}=" fills that field.`;
};

/**
 * Reads the survey's declared hidden fields out of the URL, tolerating case drift in the query
 * string: a survey declaring `CustomerRef` is filled by `?customerref=x` as well as `?CustomerRef=x`.
 *
 * The record is always keyed by the declared name, so downstream consumers only ever see the
 * spelling the survey defines. Params the link survey reads for itself are never captured — see
 * `getRefusalReason` for the exact rule and the grandfather clause inside it.
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

    const refusalReason = getRefusalReason(declaredFieldId, matchedParamKey);
    if (refusalReason !== undefined) {
      // Says so out loud rather than dropping in silence: the console is the only channel that
      // reaches someone who can fix the survey or the link. Rare across surveys (needs the survey to
      // declare the name AND the param to arrive), but on an affected survey it prints for every
      // visitor whose URL carries the param. Accepted; the alternative is silence.
      if (isBrowser()) {
        console.warn(refusalReason);
      }
      continue;
    }

    const answer = searchParams.get(matchedParamKey);
    if (answer) fieldsRecord[declaredFieldId] = answer;
  }

  return fieldsRecord;
};

/**
 * The client-side canary for a survey that reached the link page without its Embedded Data rows —
 * a select that dropped the `embeddedDataLinks` join. The allow-list is those rows and nothing else,
 * so such a survey silently stops capturing every URL parameter.
 *
 * The signal is the missing `embeddedFields` key: a survey with no fields carries an empty list. It
 * used to be the legacy `hiddenFields.fieldIds` column disagreeing with the rows; since ENG-2404
 * that is derived from the same rows, so it can no longer disagree.
 *
 * This is the ONLY signal on the link path. ENG-1845's server-side warning cannot fire here: the
 * renderer submits the contract-filtered record, so with no rows the unknown keys never reach the
 * server — and with an empty allow-list nothing reaches the client contract either, so its per-key
 * console lines are silent too.
 */
export const warnOnMissingEmbeddedDataJoin = (hasEmbeddedFields: boolean): void => {
  if (isBrowser() && !hasEmbeddedFields) {
    console.warn(
      "Formbricks: this survey was loaded without its Embedded Data fields, so no URL parameter can fill them."
    );
  }
};
