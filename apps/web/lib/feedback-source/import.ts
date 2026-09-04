import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import {
  TFeedbackSourceFormbricksMapping,
  TFeedbackSourceWithMappings,
} from "@formbricks/types/feedback-source";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getResponses } from "../response/service";
import { reconcileFeedbackRecords } from "./reconcile";
import { transformResponseToFeedbackRecords } from "./transform";
import { getErrorMessage } from "./utils";

const IMPORT_BATCH_SIZE = 50;

export type TImportResult = { successes: number; failures: number; skipped: number };

const processBatch = async (
  responses: Awaited<ReturnType<typeof getResponses>>,
  survey: TSurvey,
  mappings: TFeedbackSourceFormbricksMapping[],
  tenantId: string,
  snapshotAt: Date
): Promise<TImportResult> => {
  let successes = 0;
  let failures = 0;
  // Only this survey's mappings count towards the expectation. `transformResponseToFeedbackRecords`
  // filters on `m.surveyId === survey.id`, so counting every mapping the source holds would report
  // the other surveys' mappings as `skipped` records that were never expected in the first place.
  // No change while a source binds one survey; it keeps the number honest once one binds several.
  const surveyMappings = mappings.filter((mapping) => mapping.surveyId === survey.id);
  const expectedRecords = responses.length * surveyMappings.length;

  const allRecords = responses.flatMap((response) => {
    try {
      return transformResponseToFeedbackRecords(response, survey, mappings, tenantId);
    } catch (error) {
      // Contain a per-response transform failure so one malformed response can't abort the
      // entire historical import (the live pipeline path already isolates per response). The
      // response yields no records and is counted under `skipped`; the cause is logged.
      logger.error(
        { surveyId: survey.id, responseId: response.id, error: getErrorMessage(error) },
        "Historical import: failed to transform response, skipping"
      );
      return [];
    }
  });

  if (allRecords.length > 0) {
    // Reconcile rather than count-and-drop: a 409 means the response was already ingested, and the
    // answers may have changed since. Blindly skipping is what left Hub holding stale values.
    //
    // snapshotAt is when this page of responses was read. An import can run for a long time, so a
    // record the live pipeline corrected in the meantime must not be reverted to this older copy.
    const reconciled = await reconcileFeedbackRecords(allRecords, tenantId, { snapshotAt });
    // A reconciled record was updated, so it counts as a success rather than a skip. Previously a
    // 409 landed in `skipped`, which is how "we silently kept the stale value" read as normal.
    // Superseded records are successes too: Hub holds a *newer* value, so it is already correct.
    successes = reconciled.created + reconciled.reconciled + reconciled.superseded;
    failures = reconciled.failures.length;
  }

  // Approximate, and only ever about mapping: how many (response x mapping) pairs produced no
  // record, e.g. an unanswered question. It assumes one record per mapping, which matrix, ranking
  // and multi-select break — those expand one mapping into several records, so this can undercount
  // and even go negative for them. Pre-existing (unchanged by ENG-2058) and only ever a reporting
  // number, never a control-flow input.
  const unmappedSkipped = expectedRecords - allRecords.length;
  return { successes, failures, skipped: unmappedSkipped };
};

export const importHistoricalResponses = async (
  feedbackSource: TFeedbackSourceWithMappings,
  survey: TSurvey
): Promise<TImportResult> => {
  if (feedbackSource.type !== "formbricks_survey") {
    throw new InvalidInputError("Historical import is only supported for Formbricks feedbackSources");
  }

  let successes = 0;
  let failures = 0;
  let skipped = 0;
  let offset = 0;

  // Match the live ingestion path, which only runs on responseFinished. Without this the two
  // disagreed: the historical import pulled partials that the pipeline would never have sent.
  // "all" opts into partials — answers a respondent typed but never submitted.
  const filterCriteria =
    feedbackSource.importMode === "completedOnly" ? ({ finished: true } as const) : undefined;

  while (true) {
    // Taken before the read so it can never be later than the data it describes: a guard that
    // wrongly thinks our copy is fresh would revert a newer write, which is the failure being
    // prevented. Erring the other way only skips a redundant PATCH.
    const snapshotAt = new Date();
    const responses = await getResponses(survey.id, IMPORT_BATCH_SIZE, offset, filterCriteria);
    if (responses.length === 0) break;

    const batch = await processBatch(
      responses,
      survey,
      feedbackSource.formbricksMappings,
      feedbackSource.feedbackDirectoryId,
      snapshotAt
    );
    successes += batch.successes;
    failures += batch.failures;
    skipped += batch.skipped;

    if (responses.length < IMPORT_BATCH_SIZE) break;
    offset += IMPORT_BATCH_SIZE;
  }

  return { successes, failures, skipped };
};
