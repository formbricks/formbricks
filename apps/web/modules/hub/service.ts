import "server-only";
import FormbricksHub from "@formbricks/hub";
import { logger } from "@formbricks/logger";
import { getHubClient } from "./hub-client";
import type {
  FeedbackRecordCreateParams,
  FeedbackRecordData,
  FeedbackRecordListParams,
  FeedbackRecordListResponse,
  FeedbackRecordUpdateParams,
} from "./types";

type HubError = { status: number; message: string; detail: string };

export type HubFeedbackRecordResult = {
  data: FeedbackRecordData | null;
  error: HubError | null;
};

const NO_CONFIG_ERROR = {
  status: 0,
  message: "HUB_API_KEY is not set; Hub integration is disabled.",
  detail: "HUB_API_KEY is not set; Hub integration is disabled.",
} as const;

const createResultFromError = (err: unknown): HubFeedbackRecordResult => {
  const status = err instanceof FormbricksHub.APIError ? err.status : 0;
  const message = err instanceof Error ? err.message : String(err);
  return { data: null, error: { status, message, detail: message } };
};

/**
 * Create a single feedback record in the Hub.
 * Returns a result shape with data or error; logs failures.
 */
export const createFeedbackRecord = async (
  input: FeedbackRecordCreateParams
): Promise<HubFeedbackRecordResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }
  try {
    const data = await client.feedbackRecords.create(input);
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, fieldId: input.field_id }, "Hub: createFeedbackRecord failed");
    return createResultFromError(err);
  }
};

/**
 * Retrieve a single feedback record from the Hub by id.
 */
export const retrieveFeedbackRecord = async (id: string): Promise<HubFeedbackRecordResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.feedbackRecords.retrieve(id);
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, id }, "Hub: retrieveFeedbackRecord failed");
    return createResultFromError(err);
  }
};

/**
 * Update a single feedback record in the Hub by id.
 */
export const updateFeedbackRecord = async (
  id: string,
  input: FeedbackRecordUpdateParams
): Promise<HubFeedbackRecordResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.feedbackRecords.update(id, input);
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, id }, "Hub: updateFeedbackRecord failed");
    return createResultFromError(err);
  }
};

export type ListFeedbackRecordsResult = {
  data: FeedbackRecordListResponse | null;
  error: HubError | null;
};

/**
 * List feedback records from the Hub with optional filters and pagination.
 */
export const listFeedbackRecords = async (
  params: FeedbackRecordListParams
): Promise<ListFeedbackRecordsResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }
  try {
    const data = await client.feedbackRecords.list(params);
    return { data, error: null };
  } catch (err) {
    logger.warn({ err }, "Hub: listFeedbackRecords failed");
    const status = err instanceof FormbricksHub.APIError ? err.status : 0;
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: { status, message, detail: message } };
  }
};

/**
 * Create multiple feedback records in the Hub in parallel.
 * Returns an array of results (data or error) per input; logs failures.
 */
export const createFeedbackRecordsBatch = async (
  inputs: FeedbackRecordCreateParams[]
): Promise<{ results: HubFeedbackRecordResult[] }> => {
  const client = getHubClient();
  if (!client) {
    return {
      results: inputs.map(() => ({ data: null, error: { ...NO_CONFIG_ERROR } })),
    };
  }

  const results = await Promise.all(
    inputs.map(async (input) => {
      try {
        const data = await client.feedbackRecords.create(input);
        return { data, error: null as HubFeedbackRecordResult["error"] };
      } catch (err) {
        logger.warn({ err, fieldId: input.field_id }, "Hub: createFeedbackRecord failed");
        return createResultFromError(err);
      }
    })
  );
  return { results };
};
