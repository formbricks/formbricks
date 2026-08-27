import { matchDeclaredFieldName } from "@formbricks/types/safe-identifier";
import { RESERVED_DECLARED_FIELD_NAMES } from "@formbricks/types/surveys/validation";

type TSearchParamsWithKeys = Pick<URLSearchParams, "keys" | "get">;

/**
 * Both diagnostics below are for the survey author's browser console. This module also runs during
 * SSR (the client component is server-rendered), where the same lines would land in the operator's
 * Next log once per respondent — an audience that can do nothing with them. Capture behavior itself
 * must stay identical on both passes; only the console output is browser-gated.
 */
const isBrowser = (): boolean => globalThis.window !== undefined;

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

    // `ZSurveyHiddenFields` rejects reserved names case-sensitively, so an already-stored survey can
    // hold a field named `Verify` or `UserId` (the editor now refuses to create one). Matching
    // case-insensitively here would turn that into a way to capture reserved params - most seriously
    // `?verify=<jwt>`, the email-verification credential read by `verify-email-gate.ts`, which would
    // then be written to the response and every export.
    // Checked on the resolved param key so no casing on either side gets through.
    if (RESERVED_DECLARED_FIELD_NAMES.has(matchedParamKey.toLowerCase())) {
      // Says so out loud rather than dropping in silence. `ZSurveyHiddenFields` only guards
      // `FORBIDDEN_IDS`, and case-sensitively, so the six link-survey system params (`lang`,
      // `preview`, `startAt`, `skipPrefilled`, `offlineSupport`, `suToken`) load fine as declared
      // field names in any casing - `lang` in particular is a name someone would plausibly pick.
      // Such a field is permanently empty from the URL, and without this line its owner has nothing
      // to go on. Rare across surveys (needs the survey to declare the name AND the param to
      // arrive) - but on an affected survey it does print for every visitor whose URL carries the
      // param, e.g. a grandfathered `source` field reached by an ordinary `?source=newsletter`.
      // Accepted: the console is the only channel that reaches someone who can fix the survey, and
      // the alternative is silence.
      if (isBrowser()) {
        console.warn(
          `Formbricks: "${declaredFieldId}" is reserved by the link survey URL contract, so "?${matchedParamKey}=" can never fill it. Rename the field to collect this value.`
        );
      }
      continue;
    }

    const answer = searchParams.get(matchedParamKey);
    if (answer) fieldsRecord[declaredFieldId] = answer;
  }

  return fieldsRecord;
};

/**
 * The client-side canary for a survey whose legacy hidden-field column is populated while its
 * Embedded Data rows are missing — a dropped `embeddedDataLinks` join, or column/row drift. No
 * production write path creates that state (ENG-2412 reconciles both in one transaction), which is
 * exactly why it deserves a loud line when it appears anyway.
 *
 * This is the ONLY signal on the link path. ENG-1845's server-side missing-rows warning cannot fire
 * here: the renderer submits the contract-filtered record, so with zero ingested rows the unknown
 * keys never reach the server — and with an empty allow-list nothing reaches the client contract
 * either, so its per-key console lines are silent too. Without this, such a survey simply stops
 * capturing with no output anywhere.
 */
export const warnOnMissingIngestRows = (ingestedStorageKeys: string[], legacyFieldIds: string[]): void => {
  if (isBrowser() && ingestedStorageKeys.length === 0 && legacyFieldIds.length > 0) {
    console.warn(
      "Formbricks: this survey declares hidden fields but has no ingested Embedded Data rows, so no URL parameter can fill them."
    );
  }
};
