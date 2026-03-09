import "server-only";
import FormbricksHub from "@formbricks/hub";
import { logger } from "@formbricks/logger";
import { getHubClient } from "./hub-client";
import type {
  FeedbackRecordCreateParams,
  FeedbackRecordData,
  FeedbackRecordListParams,
  FeedbackRecordListResponse,
} from "./types";

export type CreateFeedbackRecordResult = {
  data: FeedbackRecordData | null;
  error: { status: number; message: string; detail: string } | null;
};

const NO_CONFIG_ERROR = {
  status: 0,
  message: "HUB_API_KEY is not set; Hub integration is disabled.",
  detail: "HUB_API_KEY is not set; Hub integration is disabled.",
} as const;

const createResultFromError = (err: unknown): CreateFeedbackRecordResult => {
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
): Promise<CreateFeedbackRecordResult> => {
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

export type ListFeedbackRecordsResult = {
  data: FeedbackRecordListResponse | null;
  error: { status: number; message: string; detail: string } | null;
};

/**
 * List feedback records from the Hub with optional filters and pagination.
 */
export const listFeedbackRecords = async (
  params?: FeedbackRecordListParams
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
): Promise<{ results: CreateFeedbackRecordResult[] }> => {
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
        return { data, error: null as CreateFeedbackRecordResult["error"] };
      } catch (err) {
        logger.warn({ err, fieldId: input.field_id }, "Hub: createFeedbackRecord failed");
        return createResultFromError(err);
      }
    })
  );
  return { results };
};
