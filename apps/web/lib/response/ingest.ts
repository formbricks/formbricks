import { logger } from "@formbricks/logger";
import { type TIngestResult, applyIngestContract } from "@formbricks/types/embedded-data-ingest";
import { getIngestedEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import { type TResponseData } from "@formbricks/types/responses";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { getElementsFromBlocks } from "@/lib/survey/utils";

/**
 * The survey slice the ingest contract needs. Narrow on purpose: the three boundaries that call this
 * hold a full survey, but a test should not have to build one.
 */
export type TIngestContractSurvey = Pick<TSurvey, "id" | "blocks" | "embeddedFields">;

/** How many keys one log line carries — the key list is attacker-controlled on a public endpoint. */
const MAX_LOGGED_KEYS = 20;

const capKeys = <T>(entries: readonly T[]): { entries: T[]; omitted: number } => ({
  entries: entries.slice(0, MAX_LOGGED_KEYS),
  omitted: Math.max(0, entries.length - MAX_LOGGED_KEYS),
});

/**
 * **The server side of the ingest contract (ENG-1845).** Runs the whole thing — allow-list, `locked`,
 * coercion, size limits — over an incoming `response.data` and returns what to store plus the flags
 * to persist.
 *
 * This exists because **the client's filtering is never trusted**. The renderer applies the same
 * contract for immediate developer feedback, but these endpoints are public: `validateResponseData`
 * only validates keys matching element ids, so without this a crafted request writes a locked key,
 * an unknown key or a 2 MB value straight into `response.data`, which exports, filters and the
 * summary read directly.
 *
 * Call it **before** validation and quota evaluation, so both see the values that will be stored
 * rather than the ones that arrived — and, on the POST paths, **before** `enforceVerifiedEmailGate`,
 * which stamps a `verifiedEmail` key from the verification token afterwards. `verifiedEmail` is in
 * `FORBIDDEN_IDS`, so no survey can declare it and the contract would drop it: the gate has to be
 * the last writer, exactly as it is today.
 *
 * The allow-list comes from the survey's stored rows and nothing else (ENG-2412), which means it
 * fails closed — a select that omits `embeddedDataLinks` ingests nothing. All four survey payload
 * paths carry the join today, and each has a test pinning it.
 */
export const applyIngestContractToResponseData = (
  survey: TIngestContractSurvey,
  data: TResponseData | undefined
): TIngestResult => {
  const ingestedFields = getIngestedEmbeddedFields(survey);
  const result = applyIngestContract({
    incoming: data ?? {},
    ingestedFields,
    elementIds: getElementsFromBlocks(survey.blocks).map((element) => element.id),
  });

  if (result.dropped.length > 0 || result.flags.length > 0) {
    logger.info(
      {
        surveyId: survey.id,
        dropped: capKeys(result.dropped),
        flags: capKeys(result.flags),
      },
      "Embedded Data ingest dropped or flagged incoming keys"
    );
  }

  // Louder than the line above, on purpose. The allow-list is the joined rows and nothing else, so it
  // fails closed: if a select drops `embeddedDataLinks`, every incoming value becomes an
  // `unknown_key` and ingestion is dead for every response on this survey. Through the generic line
  // that reads exactly like one typo'd param, which is why this gets its own message and level.
  //
  // The signal is the missing key itself — `embeddedFields` is absent only when the join was not
  // selected, while a survey with no fields carries an empty list. (Until ENG-2404 this compared
  // against the legacy `fieldIds` column; that is derived from the same rows now, so it can no longer
  // disagree with them.) Gated on something actually having been dropped, so a survey nobody sends
  // params to stays quiet.
  if (survey.embeddedFields === undefined && result.dropped.some(({ reason }) => reason === "unknown_key")) {
    logger.warn(
      { surveyId: survey.id, dropped: capKeys(result.dropped) },
      "Embedded Data ingest ran against a survey read without its Embedded Data rows, so every incoming value was dropped"
    );
  }

  return result;
};
