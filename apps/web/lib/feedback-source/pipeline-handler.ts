import "server-only";
import { logger } from "@formbricks/logger";
import { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";
import { TResponse } from "@formbricks/types/responses";
import type { FeedbackRecordCreateParams } from "@/modules/hub";
import { isHubNotConfigured } from "@/modules/hub/utils";
import { type TReconcileFailure, reconcileFeedbackRecords } from "./reconcile";
import { getFeedbackSourcesBySurveyId, updateFeedbackSource } from "./service";
import { type TFeedbackRecordSurvey, transformResponseToFeedbackRecords } from "./transform";
import { getErrorMessage } from "./utils";

/**
 * Waits before each re-send of records that failed transiently; its length bounds the retries (ENG-3884).
 *
 * `@formbricks/hub` 0.14 stopped re-sending a create after a 5xx, a network error or a timeout, because Hub has
 * no idempotency keys. That is right for the SDK, but this path has no other retry: the response pipeline job
 * also runs integrations and follow-ups, so failing the job to let BullMQ retry would repeat those too. A
 * re-send from here is safe because reconcile turns the 409 of a record that did land into an update.
 *
 * Sized for the window a terminating Hub pod still receives traffic (a few seconds): two retries, 5 s of waiting.
 */
const RETRY_DELAYS_MS = [1_000, 4_000] as const;

/**
 * No retry starts once this much time has passed since the first attempt.
 *
 * The delays bound the waiting, not the attempts: the SDK's per-attempt timeout is far longer, and the
 * pipeline worker handles one job at a time. A Hub that hangs rather than refusing is not the short blip
 * this retry is for, so it gets the single attempt it had before rather than holding the worker three times
 * as long.
 */
const RETRY_BUDGET_MS = 15_000;

/**
 * Statuses where Hub may well accept the same record a moment later.
 *
 * 429 is left out on purpose: the SDK already re-sends a POST on 429, honouring `Retry-After`.
 */
const TRANSIENT_STATUSES = new Set([408, 500, 502, 503, 504]);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * True when re-sending the record could succeed.
 *
 * Status 0 is a failure without an HTTP answer — connection refused or reset, a timeout — except for the
 * unconfigured-Hub sentinel, which no retry fixes. A record with no status at all comes from reconcile's own
 * checks (e.g. a conflict not visible in the tenant), which a re-send would not change either.
 */
const isTransientFailure = ({ error }: TReconcileFailure): boolean => {
  if (error.status === undefined) return false;
  if (error.status === 0) return !isHubNotConfigured(error);
  return TRANSIENT_STATUSES.has(error.status);
};

type TRetriedReconcileResult = {
  created: number;
  reconciled: number;
  superseded: number;
  /** Indexes point into the records passed in, not into the last retry's subset. */
  failures: TReconcileFailure[];
  attempts: number;
};

/**
 * `reconcileFeedbackRecords`, re-sending only the records that failed transiently, bounded by the delays and
 * the time budget.
 */
const reconcileWithRetry = async (
  records: FeedbackRecordCreateParams[],
  tenantId: string
): Promise<TRetriedReconcileResult> => {
  const result: TRetriedReconcileResult = {
    created: 0,
    reconciled: 0,
    superseded: 0,
    failures: [],
    attempts: 0,
  };
  const startedAt = Date.now();
  let pending = records.map((record, index) => ({ record, index }));

  while (pending.length > 0) {
    const attempt = await reconcileFeedbackRecords(
      pending.map(({ record }) => record),
      tenantId
    );
    result.attempts += 1;
    result.created += attempt.created;
    result.reconciled += attempt.reconciled;
    result.superseded += attempt.superseded;

    const failures = attempt.failures.map((failure) => ({ ...failure, index: pending[failure.index].index }));
    const delay = RETRY_DELAYS_MS[result.attempts - 1];
    const canRetry = delay !== undefined && Date.now() - startedAt + delay <= RETRY_BUDGET_MS;
    const retryable = canRetry ? failures.filter(isTransientFailure) : [];

    result.failures.push(...failures.filter((failure) => !retryable.includes(failure)));

    if (retryable.length > 0) {
      await sleep(delay);

      // Timers can fire late on a busy event loop; never start a request once the budget is spent.
      if (Date.now() - startedAt > RETRY_BUDGET_MS) {
        result.failures.push(...retryable);
        break;
      }
    }

    pending = retryable.map(({ index }) => ({ record: records[index], index }));
  }

  result.failures.sort((a, b) => a.index - b.index);

  return result;
};

/**
 * Per-record failure detail, at debug.
 *
 * Debug, not error: the Hub service layer already warned per record with the full error, and the
 * caller warns once with the failure count. At error level a single Hub outage reported itself
 * three times per record and looked like an unhandled fault, when the pipeline handles it. Note the
 * default level is warn in production and info in dev, so this is off in both unless
 * LOG_LEVEL=debug — the per-record index it adds is opt-in, and the warn above is what you
 * normally see. Pinned by a test; the levels are an operator-visible contract (ENG-1916).
 */
const logFailedRecords = (feedbackSourceId: string, failures: TReconcileFailure[]): void => {
  for (const failure of failures) {
    logger.debug(
      {
        feedbackSourceId,
        feedbackRecordIndex: failure.index,
        error: failure.error,
      },
      "Failed to create FeedbackRecord"
    );
  }
};

const processFeedbackSource = async (
  feedbackSource: TFeedbackSourceWithMappings,
  response: TResponse,
  survey: TFeedbackRecordSurvey,
  workspaceId: string
): Promise<void> => {
  const feedbackRecords = transformResponseToFeedbackRecords(
    response,
    survey,
    feedbackSource.formbricksMappings,
    feedbackSource.feedbackDirectoryId
  );

  if (feedbackRecords.length === 0) {
    return;
  }

  // Reconciling rather than blind-creating: a response already ingested as a partial (historical
  // import with importMode "all") would otherwise 409 on every field it already has, leaving Hub
  // holding the partial answer and logging each conflict as an error.
  const { created, reconciled, superseded, failures, attempts } = await reconcileWithRetry(
    feedbackRecords,
    feedbackSource.feedbackDirectoryId
  );

  // No snapshotAt is passed from here on purpose: this path runs on responseFinished with data read
  // moments ago, so it is the freshest writer and should never defer. `superseded` is therefore
  // expected to stay 0 here, but it is counted rather than dropped so the totals always add up.
  const successes = created + reconciled + superseded;

  if (failures.length > 0) {
    logger.warn(
      {
        feedbackSourceId: feedbackSource.id,
        surveyId: survey.id,
        responseId: response.id,
        created,
        reconciled,
        successes,
        failures: failures.length,
        attempts,
      },
      `FeedbackSource pipeline: ${failures.length}/${feedbackRecords.length} FeedbackRecords failed to send`
    );
    logFailedRecords(feedbackSource.id, failures);
  } else {
    logger.info(
      {
        feedbackSourceId: feedbackSource.id,
        surveyId: survey.id,
        responseId: response.id,
        created,
        reconciled,
        successes,
      },
      `FeedbackSource pipeline: Successfully sent ${successes} FeedbackRecords`
    );
  }

  if (successes > 0) {
    await updateFeedbackSource(feedbackSource.id, workspaceId, { lastSyncAt: new Date() });
  }
};

/**
 * Handle feedbackSource pipeline for a survey response
 *
 * This function is called from the pipeline when a response is created/finished.
 * It looks up active feedbackSources for the survey and sends the response data.
 *
 * @param response - The survey response
 * @param survey - The survey
 * @param workspaceId - The workspace ID (access-control context; the Hub tenant is feedbackSource.feedbackDirectoryId)
 */
export const handleFeedbackSourcePipeline = async (
  response: TResponse,
  survey: TFeedbackRecordSurvey,
  workspaceId: string
): Promise<void> => {
  try {
    const feedbackSources = await getFeedbackSourcesBySurveyId(survey.id);

    if (feedbackSources.length === 0) {
      return;
    }

    for (const feedbackSource of feedbackSources) {
      try {
        await processFeedbackSource(feedbackSource, response, survey, workspaceId);
      } catch (error) {
        logger.error(
          {
            feedbackSourceId: feedbackSource.id,
            surveyId: survey.id,
            responseId: response.id,
            error: getErrorMessage(error),
          },
          "FeedbackSource pipeline: Failed to process feedbackSource"
        );
      }
    }
  } catch (error) {
    logger.error(
      {
        surveyId: survey.id,
        responseId: response.id,
        error: getErrorMessage(error),
      },
      "FeedbackSource pipeline: Failed to handle feedbackSources"
    );
  }
};
