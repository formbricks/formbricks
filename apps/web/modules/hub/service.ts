import "server-only";
import FormbricksHub from "@formbricks/hub";
import { logger } from "@formbricks/logger";
import { env } from "@/lib/env";
import { getHubClient } from "./hub-client";
import type {
  FeedbackRecordCreateParams,
  FeedbackRecordData,
  FeedbackRecordListParams,
  FeedbackRecordListResponse,
  FeedbackRecordUpdateParams,
  SemanticSearchInput,
  SemanticSearchResponse,
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

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
};

const createResultFromError = (err: unknown): HubFeedbackRecordResult => {
  const status = err instanceof FormbricksHub.APIError ? err.status : 0;
  const message = getErrorMessage(err);
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

export type SemanticSearchFeedbackRecordsResult = {
  data: SemanticSearchResponse | null;
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
    const message = getErrorMessage(err);
    return { data: null, error: { status, message, detail: message } };
  }
};

export const semanticSearchFeedbackRecords = async (
  input: SemanticSearchInput
): Promise<SemanticSearchFeedbackRecordsResult> => {
  const apiKey = env.HUB_API_KEY;
  if (!apiKey) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  const url = new URL("/v1/feedback-records/search/semantic", env.HUB_API_URL);
  if (input.limit !== undefined) url.searchParams.set("limit", String(input.limit));
  if (input.cursor) url.searchParams.set("cursor", input.cursor);
  if (input.min_score !== undefined) url.searchParams.set("min_score", String(input.min_score));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: input.query,
        tenant_id: input.tenant_id,
      }),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as {
        detail?: string;
        title?: string;
      } | null;
      const message = errorBody?.detail ?? errorBody?.title ?? response.statusText;
      return { data: null, error: { status: response.status, message, detail: message } };
    }

    const data = (await response.json()) as SemanticSearchResponse;
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, tenantId: input.tenant_id }, "Hub: semanticSearchFeedbackRecords failed");
    const message = getErrorMessage(err);
    return { data: null, error: { status: 0, message, detail: message } };
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
