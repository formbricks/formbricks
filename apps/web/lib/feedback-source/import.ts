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
  tenantId: string
): Promise<TImportResult> => {
  let successes = 0;
  let failures = 0;
  const expectedRecords = responses.length * mappings.length;

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
    const reconciled = await reconcileFeedbackRecords(allRecords, tenantId);
    // A reconciled record was updated, so it counts as a success rather than a skip. Previously a
    // 409 landed in `skipped`, which is how "we silently kept the stale value" read as normal.
    successes = reconciled.created + reconciled.reconciled;
    failures = reconciled.failures.length;
  }

  // `skipped` now means only "the response had nothing to map for this field".
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
    const responses = await getResponses(survey.id, IMPORT_BATCH_SIZE, offset, filterCriteria);
    if (responses.length === 0) break;

    const batch = await processBatch(
      responses,
      survey,
      feedbackSource.formbricksMappings,
      feedbackSource.feedbackDirectoryId
    );
    successes += batch.successes;
    failures += batch.failures;
    skipped += batch.skipped;

    if (responses.length < IMPORT_BATCH_SIZE) break;
    offset += IMPORT_BATCH_SIZE;
  }

  return { successes, failures, skipped };
};
