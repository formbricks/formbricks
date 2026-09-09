import {
  type TIngestDropReason,
  type TIngestFlagReason,
  type TIngestResult,
} from "@formbricks/types/embedded-data-ingest";

/**
 * What the renderer says about each verdict. Phrased as what happened to the *incoming value*, never
 * as a claim about the response: a host surface can legitimately hand the renderer a key the survey
 * does not declare — the link page passes the verified email address alongside the URL params — and
 * the server writes that one itself, so "ignored here" is the honest report and "not stored" would
 * not be.
 */
export const INGEST_DROP_MESSAGES: Record<TIngestDropReason, string> = {
  unknown_key: "is not an ingested Embedded Data field on this survey",
  locked_field: "is locked and ignores values set from outside",
  unsupported_value: "arrived as a value no Embedded Data field can hold",
  element_id_collision: "is a question's id, so that question's answer owns the key",
};

const INGEST_FLAG_MESSAGES: Record<TIngestFlagReason, string> = {
  coercion_failed: "did not match its declared type and was kept as text",
  truncated: "was longer than the 16 KB limit and was truncated",
};

/**
 * Keys the **product itself** puts into the incoming bag, so warning about them would fire once per
 * respondent and tell a developer nothing. The link survey wrapper adds `verifiedEmail` on every load
 * of an email-verified survey, and `FORBIDDEN_IDS` guarantees no survey can declare it — so it is
 * always dropped as an unknown key. The server writes the real value from the token regardless.
 *
 * Deliberately **not** the whole of `RESERVED_DECLARED_FIELD_NAMES` (ENG-1843). That muted sixteen
 * further names, every one of which a host can genuinely send by mistake — and those are exactly the
 * ones worth reporting. Add to this set only when the product starts injecting another key itself.
 * A `.ts` module rather than a constant inside the component, so this split is unit-testable and
 * re-widening the mute goes red instead of shipping silently.
 */
const SELF_INJECTED_KEYS = new Set(["verifiedemail"]);

/**
 * Surfaces the ingest contract's verdicts, so a developer wiring up Embedded Data sees why a value
 * did not show up instead of guessing. Warnings, never errors: nothing here blocks a response.
 *
 * Advisory only. The stored flags are the server's, recomputed on ingest from the same contract,
 * because a client-sent flag list could claim there was nothing to report.
 */
export const logIngestResult = ({ dropped, flags }: TIngestResult): void => {
  for (const { key, reason } of dropped) {
    if (SELF_INJECTED_KEYS.has(key.toLowerCase())) continue;
    console.warn(`Formbricks: "${key}" ${INGEST_DROP_MESSAGES[reason]}, so the value was ignored.`);
  }
  for (const { key, reason } of flags) {
    console.warn(`Formbricks: the value for "${key}" ${INGEST_FLAG_MESSAGES[reason]}.`);
  }
};
