import "server-only";
import { logger } from "@formbricks/logger";

// Hub API base URL - should be configurable via environment variable
const HUB_API_URL = process.env.HUB_API_URL || "http://localhost:8080";
const HUB_API_KEY = process.env.HUB_API_KEY || "";

// Hub field types (from OpenAPI spec)
export type THubFieldType =
  | "text"
  | "categorical"
  | "nps"
  | "csat"
  | "ces"
  | "rating"
  | "number"
  | "boolean"
  | "date";

// Create FeedbackRecord input
export interface TCreateFeedbackRecordInput {
  collected_at?: string; // ISO 8601 datetime, defaults to now
  source_type: string; // Required
  field_id: string; // Required
  field_type: THubFieldType; // Required
  tenant_id?: string;
  response_id?: string;
  source_id?: string;
  source_name?: string;
  field_label?: string;
  value_text?: string;
  value_number?: number;
  value_boolean?: boolean;
  value_date?: string;
  metadata?: Record<string, unknown>;
  language?: string;
  user_identifier?: string;
}

// FeedbackRecord data (response from Hub)
export interface TFeedbackRecordData {
  id: string;
  collected_at: string;
  created_at: string;
  updated_at: string;
  source_type: string;
  field_id: string;
  field_type: string;
  tenant_id?: string;
  response_id?: string;
  source_id?: string;
  source_name?: string;
  field_label?: string;
  value_text?: string;
  value_number?: number;
  value_boolean?: boolean;
  value_date?: string;
  metadata?: Record<string, unknown>;
  language?: string;
  user_identifier?: string;
}

// List FeedbackRecords response
export interface TListFeedbackRecordsResponse {
  data: TFeedbackRecordData[];
  total: number;
  limit: number;
  offset: number;
}

// Update FeedbackRecord input
export interface TUpdateFeedbackRecordInput {
  value_text?: string;
  value_number?: number;
  value_boolean?: boolean;
  value_date?: string;
  metadata?: Record<string, unknown>;
  language?: string;
  user_identifier?: string;
}

// List FeedbackRecords filters
export interface TListFeedbackRecordsFilters {
  tenant_id?: string;
  response_id?: string;
  source_type?: string;
  source_id?: string;
  field_id?: string;
  field_type?: string;
  user_identifier?: string;
  since?: string; // ISO 8601
  until?: string; // ISO 8601
  limit?: number;
  offset?: number;
}

// Error response from Hub
export interface THubErrorResponse {
  type?: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: Array<{
    location?: string;
    message?: string;
    value?: unknown;
  }>;
}

// Hub API Error class
export class HubApiError extends Error {
  status: number;
  detail: string;
  errors?: THubErrorResponse["errors"];

  constructor(response: THubErrorResponse) {
    super(response.detail || response.title);
    this.name = "HubApiError";
    this.status = response.status;
    this.detail = response.detail;
    this.errors = response.errors;
  }
}

// Make authenticated request to Hub API
async function hubFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: HubApiError | null }> {
  const url = `${HUB_API_URL}${path}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(HUB_API_KEY && { Authorization: `Bearer ${HUB_API_KEY}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle no content response (e.g., DELETE)
    if (response.status === 204) {
      return { data: null, error: null };
    }

    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      // Try to parse error response
      if (contentType?.includes("application/problem+json") || contentType?.includes("application/json")) {
        const errorBody = (await response.json()) as THubErrorResponse;
        return { data: null, error: new HubApiError(errorBody) };
      }

      // Fallback for non-JSON errors
      const errorText = await response.text();
      return {
        data: null,
        error: new HubApiError({
          title: "Error",
          status: response.status,
          detail: errorText || `HTTP ${response.status}`,
        }),
      };
    }

    // Parse successful response
    if (contentType?.includes("application/json")) {
      const data = (await response.json()) as T;
      return { data, error: null };
    }

    return { data: null, error: null };
  } catch (error) {
    logger.error("Hub API request failed", { url, error });
    return {
      data: null,
      error: new HubApiError({
        title: "Network Error",
        status: 0,
        detail: error instanceof Error ? error.message : "Failed to connect to Hub API",
      }),
    };
  }
}

/**
 * Create a new FeedbackRecord in the Hub
 */
export async function createFeedbackRecord(
  input: TCreateFeedbackRecordInput
): Promise<{ data: TFeedbackRecordData | null; error: HubApiError | null }> {
  return hubFetch<TFeedbackRecordData>("/v1/feedback-records", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Create multiple FeedbackRecords in the Hub (batch)
 */
export async function createFeedbackRecordsBatch(
  inputs: TCreateFeedbackRecordInput[]
): Promise<{ results: Array<{ data: TFeedbackRecordData | null; error: HubApiError | null }> }> {
  // Hub doesn't have a batch endpoint, so we'll do parallel requests
  // In production, you might want to implement rate limiting or chunking
  const results = await Promise.all(inputs.map((input) => createFeedbackRecord(input)));
  return { results };
}

/**
 * List FeedbackRecords from the Hub with optional filters
 */
export async function listFeedbackRecords(
  filters: TListFeedbackRecordsFilters = {}
): Promise<{ data: TListFeedbackRecordsResponse | null; error: HubApiError | null }> {
  const searchParams = new URLSearchParams();

  if (filters.tenant_id) searchParams.set("tenant_id", filters.tenant_id);
  if (filters.response_id) searchParams.set("response_id", filters.response_id);
  if (filters.source_type) searchParams.set("source_type", filters.source_type);
  if (filters.source_id) searchParams.set("source_id", filters.source_id);
  if (filters.field_id) searchParams.set("field_id", filters.field_id);
  if (filters.field_type) searchParams.set("field_type", filters.field_type);
  if (filters.user_identifier) searchParams.set("user_identifier", filters.user_identifier);
  if (filters.since) searchParams.set("since", filters.since);
  if (filters.until) searchParams.set("until", filters.until);
  if (filters.limit !== undefined) searchParams.set("limit", String(filters.limit));
  if (filters.offset !== undefined) searchParams.set("offset", String(filters.offset));

  const queryString = searchParams.toString();
  const path = queryString ? `/v1/feedback-records?${queryString}` : "/v1/feedback-records";

  return hubFetch<TListFeedbackRecordsResponse>(path, { method: "GET" });
}

/**
 * Get a single FeedbackRecord from the Hub by ID
 */
export async function getFeedbackRecord(
  id: string
): Promise<{ data: TFeedbackRecordData | null; error: HubApiError | null }> {
  return hubFetch<TFeedbackRecordData>(`/v1/feedback-records/${id}`, { method: "GET" });
}

/**
 * Update a FeedbackRecord in the Hub
 */
export async function updateFeedbackRecord(
  id: string,
  input: TUpdateFeedbackRecordInput
): Promise<{ data: TFeedbackRecordData | null; error: HubApiError | null }> {
  return hubFetch<TFeedbackRecordData>(`/v1/feedback-records/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/**
 * Delete a FeedbackRecord from the Hub
 */
export async function deleteFeedbackRecord(id: string): Promise<{ error: HubApiError | null }> {
  const result = await hubFetch<null>(`/v1/feedback-records/${id}`, { method: "DELETE" });
  return { error: result.error };
}

/**
 * Bulk delete FeedbackRecords by user identifier (GDPR compliance)
 */
export async function bulkDeleteFeedbackRecordsByUser(
  userIdentifier: string,
  tenantId?: string
): Promise<{ data: { deleted_count: number; message: string } | null; error: HubApiError | null }> {
  const searchParams = new URLSearchParams();
  searchParams.set("user_identifier", userIdentifier);
  if (tenantId) searchParams.set("tenant_id", tenantId);

  return hubFetch<{ deleted_count: number; message: string }>(
    `/v1/feedback-records?${searchParams.toString()}`,
    { method: "DELETE" }
  );
}

/**
 * Check Hub API health
 */
export async function checkHubHealth(): Promise<{ healthy: boolean; error: HubApiError | null }> {
  try {
    const response = await fetch(`${HUB_API_URL}/health`);
    if (response.ok) {
      return { healthy: true, error: null };
    }
    return {
      healthy: false,
      error: new HubApiError({
        title: "Health Check Failed",
        status: response.status,
        detail: "Hub API health check failed",
      }),
    };
  } catch (error) {
    return {
      healthy: false,
      error: new HubApiError({
        title: "Network Error",
        status: 0,
        detail: error instanceof Error ? error.message : "Failed to connect to Hub API",
      }),
    };
  }
}
