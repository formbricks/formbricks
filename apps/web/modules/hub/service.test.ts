import { beforeEach, describe, expect, test, vi } from "vitest";
import { createCacheKey } from "@formbricks/cache";
import * as hub from "@formbricks/hub";
import { logger } from "@formbricks/logger";
import {
  countFeedbackRecords,
  createFeedbackRecord,
  createFeedbackRecordsBatch,
  createTaxonomyRun,
  deleteFeedbackRecord,
  deleteHubTenantData,
  findSimilarFeedbackRecords,
  getActiveTaxonomyTree,
  getEnrichmentStatus,
  getFeedbackRecordTenant,
  getTaxonomyRun,
  getTaxonomyTree,
  listFeedbackRecords,
  listTaxonomyFields,
  listTaxonomyNodeRecordCounts,
  listTaxonomyNodeRecords,
  listTaxonomyRuns,
  purgeHubFeedbackRecords,
  removeTaxonomyNode,
  renameTaxonomyNode,
  retrieveFeedbackRecord,
  semanticSearchFeedbackRecords,
  updateFeedbackRecord,
} from "./service";
import type { FeedbackRecordCreateParams } from "./types";
import { HubApiError } from "./utils";

vi.mock("@formbricks/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@formbricks/hub", () => ({
  countFeedbackRecords: vi.fn(),
  countTaxonomyNodeRecords: vi.fn(),
  createFeedbackRecord: vi.fn(),
  createTaxonomyRun: vi.fn(),
  deleteFeedbackRecord: vi.fn(),
  deleteTenantData: vi.fn(),
  getActiveTaxonomyTree: vi.fn(),
  getEnrichmentStatus: vi.fn(),
  getFeedbackRecord: vi.fn(),
  getTaxonomyRun: vi.fn(),
  getTaxonomyRunTree: vi.fn(),
  listFeedbackRecords: vi.fn(),
  listTaxonomyFields: vi.fn(),
  listTaxonomyNodeRecords: vi.fn(),
  listTaxonomyRuns: vi.fn(),
  purgeTenantFeedbackRecords: vi.fn(),
  removeTaxonomyNode: vi.fn(),
  renameTaxonomyNode: vi.fn(),
  semanticSearchFeedbackRecords: vi.fn(),
  similarFeedbackRecords: vi.fn(),
  updateFeedbackRecord: vi.fn(),
}));

vi.mock("./hub-client", () => ({
  getHubClient: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  cache: {
    withCache: vi.fn(async (fn: () => Promise<unknown>) => await fn()),
  },
}));

const { getHubClient } = await import("./hub-client");
const { cache } = await import("@/lib/cache");

/** Opaque to the service: it only ever hands the client to the SDK functions. */
const client = { id: "hub-client" } as unknown as hub.Client;

const useClient = () => vi.mocked(getHubClient).mockReturnValue(client);

/** The `{ data, request, response }` a `throwOnError` call resolves with. */
const resolved = (data: unknown) =>
  ({ data, request: new Request("https://hub.test"), response: new Response() }) as never;

/** What `hub-client.ts`'s error interceptor produces for a non-2xx response. */
const apiError = (status: number, body?: unknown) => new HubApiError(status, body, new Headers());

const NO_CONFIG_MESSAGE = "HUB_API_KEY is not set; Hub integration is disabled.";

const sampleInput: FeedbackRecordCreateParams = {
  field_id: "el-1",
  field_type: "rating",
  source_type: "formbricks_survey",
  source_id: "survey-1",
  source_name: "Test Survey",
  field_label: "Question?",
  value_number: 5,
  collected_at: "2026-02-24T10:00:00.000Z",
  submission_id: "sub-1",
  tenant_id: "tenant-1",
};

const taxonomyScope = {
  tenant_id: "tenant-1",
  source_type: "formbricks_survey",
  source_id: "survey-1",
  field_id: "question-1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hub service", () => {
  describe("createFeedbackRecord", () => {
    test("returns error result when getHubClient returns null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);

      const result = await createFeedbackRecord(sampleInput);

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 0, message: NO_CONFIG_MESSAGE });
      expect(hub.createFeedbackRecord).not.toHaveBeenCalled();
    });

    test("returns data when the create succeeds", async () => {
      useClient();
      const created = { id: "hub-1", ...sampleInput };
      vi.mocked(hub.createFeedbackRecord).mockResolvedValue(resolved(created));

      const result = await createFeedbackRecord(sampleInput);

      expect(result.error).toBeNull();
      expect(result.data).toEqual(created);
    });

    test("forwards value_id to the Hub (ENG-1673)", async () => {
      useClient();
      vi.mocked(hub.createFeedbackRecord).mockResolvedValue(resolved({ id: "hub-1" }));

      await createFeedbackRecord({ ...sampleInput, value_id: "c-male" });

      expect(hub.createFeedbackRecord).toHaveBeenCalledWith({
        client,
        body: { ...sampleInput, value_id: "c-male" },
        throwOnError: true,
      });
    });

    test("returns error result when the create throws", async () => {
      useClient();
      vi.mocked(hub.createFeedbackRecord).mockRejectedValue(new Error("Network error"));

      const result = await createFeedbackRecord(sampleInput);

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ message: "Network error" });
    });

    test("reads status from a foreign error class (simulates dual module scope)", async () => {
      // Simulates `utils.ts` being loaded into a second module scope under Next dev/Turbopack: the thrown
      // error is NOT instanceof the HubApiError this file imported.
      class ForeignConflictError extends Error {
        readonly status = 409;
      }
      useClient();
      vi.mocked(hub.createFeedbackRecord).mockRejectedValue(
        new ForeignConflictError("duplicate submission_id")
      );

      const result = await createFeedbackRecord(sampleInput);

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 409, message: "duplicate submission_id" });
    });
  });

  describe("listFeedbackRecords", () => {
    test("returns error result when getHubClient returns null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);

      const result = await listFeedbackRecords({ tenant_id: "env-1" });

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 0, message: NO_CONFIG_MESSAGE });
    });

    test("passes the filters through as the query and returns the page", async () => {
      useClient();
      const listResponse = { data: [{ id: "rec-1", field_id: "el-1", field_type: "rating" }], limit: 50 };
      vi.mocked(hub.listFeedbackRecords).mockResolvedValue(resolved(listResponse));

      const result = await listFeedbackRecords({ tenant_id: "env-1", limit: 50, source_type: ["a", "b"] });

      expect(hub.listFeedbackRecords).toHaveBeenCalledWith({
        client,
        query: { tenant_id: "env-1", limit: 50, source_type: ["a", "b"] },
        throwOnError: true,
      });
      expect(result.error).toBeNull();
      expect(result.data).toEqual(listResponse);
    });

    // The SDK would omit an empty array and answer with the whole tenant; the guard refuses it first.
    test("refuses an empty array filter without calling the Hub", async () => {
      useClient();

      const result = await listFeedbackRecords({ tenant_id: "env-1", source_type: [] });

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 0, message: expect.stringContaining("source_type") });
      expect(hub.listFeedbackRecords).not.toHaveBeenCalled();
    });

    test("returns error result when the list throws", async () => {
      useClient();
      vi.mocked(hub.listFeedbackRecords).mockRejectedValue(new Error("Network error"));

      const result = await listFeedbackRecords({ tenant_id: "env-1" });

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 0, message: "Network error" });
    });
  });

  describe("retrieveFeedbackRecord", () => {
    test("returns error when client is null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);
      const result = await retrieveFeedbackRecord("rec-1");
      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("HUB_API_KEY");
    });

    test("preserves taxonomy included on the Hub single-record response", async () => {
      useClient();
      const record = {
        id: "rec-1",
        field_id: "f1",
        taxonomy: { status: "unclassified", run_id: "run-1", path: [] },
      };
      vi.mocked(hub.getFeedbackRecord).mockResolvedValue(resolved(record));

      const result = await retrieveFeedbackRecord("rec-1");

      expect(hub.getFeedbackRecord).toHaveBeenCalledWith({
        client,
        path: { id: "rec-1" },
        throwOnError: true,
      });
      expect(result.data).toEqual(record);
      expect(result.error).toBeNull();
    });

    test("returns error on throw", async () => {
      useClient();
      vi.mocked(hub.getFeedbackRecord).mockRejectedValue(apiError(404, { detail: "not found" }));

      const result = await retrieveFeedbackRecord("rec-1");

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 404, problemDetail: "not found" });
    });
  });

  describe("countFeedbackRecords", () => {
    test("returns config error when getHubClient returns null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);

      const result = await countFeedbackRecords({ tenant_id: "env-1" });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("HUB_API_KEY");
    });

    test("passes the filters through and returns the count", async () => {
      useClient();
      vi.mocked(hub.countFeedbackRecords).mockResolvedValue(resolved({ count: 42 }));

      const result = await countFeedbackRecords({ tenant_id: "env-1", user_id: ["user-1"] });

      expect(hub.countFeedbackRecords).toHaveBeenCalledWith({
        client,
        query: { tenant_id: "env-1", user_id: ["user-1"] },
        throwOnError: true,
      });
      expect(result.data).toEqual({ count: 42 });
      expect(result.error).toBeNull();
    });

    test("refuses an empty array filter without calling the Hub", async () => {
      useClient();

      const result = await countFeedbackRecords({ tenant_id: "env-1", user_id: [] });

      expect(result.error).toMatchObject({ status: 0, message: expect.stringContaining("user_id") });
      expect(hub.countFeedbackRecords).not.toHaveBeenCalled();
    });

    test("returns a relayable error when the Hub rejects the filters", async () => {
      useClient();
      vi.mocked(hub.countFeedbackRecords).mockRejectedValue(
        apiError(400, { code: "validation", detail: "since must be a valid timestamp" })
      );

      const result = await countFeedbackRecords({ tenant_id: "env-1", since: "not-a-date" });

      expect(result.error).toMatchObject({
        status: 400,
        problemDetail: "since must be a valid timestamp",
      });
    });
  });

  describe("semanticSearchFeedbackRecords", () => {
    test("returns error result when getHubClient returns null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);

      const result = await semanticSearchFeedbackRecords({ tenant_id: "env-1", query: "slow checkout" });

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 0, message: NO_CONFIG_MESSAGE });
    });

    // The Hub takes the text in the body and the paging controls in the query string; sending them all in
    // the body would search with the Hub's defaults and silently ignore the caller's limit and threshold.
    test("sends the search text in the body and the paging controls in the query", async () => {
      useClient();
      const searchResponse = {
        data: [
          {
            feedback_record_id: "018e1234-5678-9abc-def0-123456789abc",
            score: 0.91,
            field_label: "What can we improve?",
            value_text: "Checkout feels slow.",
          },
        ],
        limit: 10,
      };
      vi.mocked(hub.semanticSearchFeedbackRecords).mockResolvedValue(resolved(searchResponse));

      const result = await semanticSearchFeedbackRecords({
        tenant_id: "env-1",
        query: "slow checkout",
        limit: 10,
        min_score: 0.7,
        cursor: "c1",
      });

      expect(hub.semanticSearchFeedbackRecords).toHaveBeenCalledWith({
        client,
        body: { tenant_id: "env-1", query: "slow checkout" },
        query: { limit: 10, min_score: 0.7, cursor: "c1" },
        throwOnError: true,
      });
      expect(result.error).toBeNull();
      expect(result.data).toEqual(searchResponse);
    });

    test("returns error with status when the search fails with an API error", async () => {
      useClient();
      vi.mocked(hub.semanticSearchFeedbackRecords).mockRejectedValue(
        apiError(503, { message: "Embeddings are not configured" })
      );

      const result = await semanticSearchFeedbackRecords({ tenant_id: "env-1", query: "slow checkout" });

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 503, message: "503 Embeddings are not configured" });
    });

    test("returns error result when the search throws a non-API error", async () => {
      useClient();
      vi.mocked(hub.semanticSearchFeedbackRecords).mockRejectedValue(new Error("Network error"));

      const result = await semanticSearchFeedbackRecords({ tenant_id: "env-1", query: "slow checkout" });

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 0, message: "Network error" });
    });

    // Callers map the Hub's problem members to their own response (an actionable message for the 503,
    // relayed field errors on a 4xx). A hand-built error object would drop them and degrade to generic text.
    test("preserves the Hub's RFC 9457 problem members", async () => {
      useClient();
      vi.mocked(hub.semanticSearchFeedbackRecords).mockRejectedValue(
        apiError(503, { code: "service_unavailable", detail: "embeddings are not configured" })
      );

      const result = await semanticSearchFeedbackRecords({ tenant_id: "env-1", query: "q" });

      expect(result.error).toMatchObject({
        status: 503,
        code: "service_unavailable",
        problemDetail: "embeddings are not configured",
      });
    });
  });

  describe("findSimilarFeedbackRecords", () => {
    test("returns config error when getHubClient returns null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);

      const result = await findSimilarFeedbackRecords("rec-1");

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("HUB_API_KEY");
    });

    test("passes the record id and params through and returns the matches", async () => {
      useClient();
      const response = {
        data: [
          {
            feedback_record_id: "018e1234-5678-9abc-def0-123456789abc",
            score: 0.77,
            field_label: "What can we improve?",
            value_text: "payment step was unclear",
          },
        ],
        limit: 10,
      };
      vi.mocked(hub.similarFeedbackRecords).mockResolvedValue(resolved(response));

      const result = await findSimilarFeedbackRecords("rec-1", { limit: 10, min_score: 0.5 });

      expect(hub.similarFeedbackRecords).toHaveBeenCalledWith({
        client,
        path: { id: "rec-1" },
        query: { limit: 10, min_score: 0.5 },
        throwOnError: true,
      });
      expect(result.data).toEqual(response);
      expect(result.error).toBeNull();
    });

    // The 404 is load-bearing: callers translate it into "no embedding yet" once they know the record
    // exists, so it must arrive with its status intact rather than as a generic failure. It is also an
    // expected state, so it must not be logged as a fault — a warning per call would carry a stack trace.
    test("surfaces a 404 with its status, logged as debug rather than a warning", async () => {
      useClient();
      vi.mocked(hub.similarFeedbackRecords).mockRejectedValue(
        apiError(404, { detail: "embedding not found" })
      );

      const result = await findSimilarFeedbackRecords("rec-1");

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 404 });
      expect(logger.debug).toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("updateFeedbackRecord", () => {
    test("returns error when client is null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);
      const result = await updateFeedbackRecord("rec-1", { value_text: "new" });
      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("HUB_API_KEY");
    });

    test("returns data on success", async () => {
      useClient();
      const updated = { id: "rec-1", value_text: "new" };
      vi.mocked(hub.updateFeedbackRecord).mockResolvedValue(resolved(updated));

      const result = await updateFeedbackRecord("rec-1", { value_text: "new" });

      expect(hub.updateFeedbackRecord).toHaveBeenCalledWith({
        client,
        path: { id: "rec-1" },
        body: { value_text: "new" },
        throwOnError: true,
      });
      expect(result.data).toEqual(updated);
      expect(result.error).toBeNull();
    });

    test("returns error on throw", async () => {
      useClient();
      vi.mocked(hub.updateFeedbackRecord).mockRejectedValue(apiError(403, { message: "Forbidden" }));

      const result = await updateFeedbackRecord("rec-1", { value_text: "new" });

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 403, message: "403 Forbidden" });
    });
  });

  describe("deleteFeedbackRecord", () => {
    test("returns config error when getHubClient returns null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);

      const result = await deleteFeedbackRecord("rec-1");

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("HUB_API_KEY");
    });

    test("returns data when the delete resolves", async () => {
      useClient();
      vi.mocked(hub.deleteFeedbackRecord).mockResolvedValue(resolved({}));

      const result = await deleteFeedbackRecord("rec-1");

      expect(hub.deleteFeedbackRecord).toHaveBeenCalledWith({
        client,
        path: { id: "rec-1" },
        throwOnError: true,
      });
      expect(result.data).toEqual({ deleted: true });
      expect(result.error).toBeNull();
    });

    test("returns error when the delete fails with an API error", async () => {
      useClient();
      vi.mocked(hub.deleteFeedbackRecord).mockRejectedValue(apiError(403, { message: "Forbidden" }));

      const result = await deleteFeedbackRecord("rec-1");

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 403, message: "403 Forbidden" });
    });

    test("returns error when the delete throws a non-API error", async () => {
      useClient();
      vi.mocked(hub.deleteFeedbackRecord).mockRejectedValue(new Error("network"));

      const result = await deleteFeedbackRecord("rec-1");

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 0, message: "network" });
    });

    // A tenant purge in progress is reported as a 409 with a detail the caller relays as retryable; that
    // detail only survives if the error goes through the shared problem-parsing helper.
    test("preserves the Hub's RFC 9457 problem members on a conflict", async () => {
      useClient();
      vi.mocked(hub.deleteFeedbackRecord).mockRejectedValue(
        apiError(409, { code: "tenant_write_conflict", detail: "tenant data deletion in progress" })
      );

      const result = await deleteFeedbackRecord("rec-1");

      expect(result.error).toMatchObject({
        status: 409,
        code: "tenant_write_conflict",
        problemDetail: "tenant data deletion in progress",
      });
    });
  });

  describe("deleteHubTenantData", () => {
    test("returns config error when getHubClient returns null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);

      const result = await deleteHubTenantData("tenant-1");

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("HUB_API_KEY");
    });

    test("returns mapped data when the purge resolves", async () => {
      useClient();
      vi.mocked(hub.deleteTenantData).mockResolvedValue(
        resolved({
          tenant_id: "tenant-1",
          deleted_feedback_records: 3,
          deleted_embeddings: 5,
          deleted_webhooks: 1,
        })
      );

      const result = await deleteHubTenantData("tenant-1");

      expect(hub.deleteTenantData).toHaveBeenCalledWith({
        client,
        path: { tenant_id: "tenant-1" },
        throwOnError: true,
      });
      expect(result.error).toBeNull();
      expect(result.data).toEqual({
        deletedFeedbackRecords: 3,
        deletedEmbeddings: 5,
        deletedWebhooks: 1,
      });
    });

    test("returns error when the purge throws", async () => {
      useClient();
      vi.mocked(hub.deleteTenantData).mockRejectedValue(new Error("network"));

      const result = await deleteHubTenantData("tenant-1");

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 0, message: "network" });
    });
  });

  describe("purgeHubFeedbackRecords", () => {
    test("returns config error when getHubClient returns null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);

      const result = await purgeHubFeedbackRecords("tenant-1");

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("HUB_API_KEY");
    });

    // Targets the tenant sub-resource, not the feedback-records collection: the collection prefix is
    // publicly routed by the gateway, and this must stay off it. Distinct from the offboarding purge
    // at /v1/tenants/{id}/data, which also destroys taxonomy, webhooks and settings. The path encoding
    // itself is the SDK's, pinned in `hub-client.test.ts`.
    test("targets the tenant's feedback-records sub-resource", async () => {
      useClient();
      vi.mocked(hub.purgeTenantFeedbackRecords).mockResolvedValue(
        resolved({
          tenant_id: "tenant-1",
          status: "accepted",
          message: "Feedback records purge accepted for tenant-1",
        })
      );

      const result = await purgeHubFeedbackRecords("tenant-1");

      expect(hub.purgeTenantFeedbackRecords).toHaveBeenCalledWith({
        client,
        path: { tenant_id: "tenant-1" },
        throwOnError: true,
      });
      expect(hub.deleteTenantData).not.toHaveBeenCalled();
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ tenantId: "tenant-1", status: "accepted" });
    });

    test("returns error when the purge cannot be scheduled", async () => {
      useClient();
      vi.mocked(hub.purgeTenantFeedbackRecords).mockRejectedValue(new Error("network"));

      const result = await purgeHubFeedbackRecords("tenant-1");

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 0, message: "network" });
    });
  });

  describe("createFeedbackRecordsBatch", () => {
    test("returns all errors when getHubClient returns null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);

      const result = await createFeedbackRecordsBatch([sampleInput, { ...sampleInput, field_id: "el-2" }]);

      expect(result.results).toHaveLength(2);
      result.results.forEach((r) => {
        expect(r.data).toBeNull();
        expect(r.error?.message).toContain("HUB_API_KEY is not set");
      });
    });

    test("returns results per input when the creates succeed", async () => {
      useClient();
      vi.mocked(hub.createFeedbackRecord).mockImplementation(async ({ body }) =>
        resolved({ id: `hub-${body.field_id}`, ...body })
      );

      const inputs = [sampleInput, { ...sampleInput, field_id: "el-2" }];
      const result = await createFeedbackRecordsBatch(inputs);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].data).toMatchObject({ field_id: "el-1" });
      expect(result.results[0].error).toBeNull();
      expect(result.results[1].data).toMatchObject({ field_id: "el-2" });
      expect(result.results[1].error).toBeNull();
    });

    test("returns mixed results when some creates fail", async () => {
      useClient();
      vi.mocked(hub.createFeedbackRecord)
        .mockResolvedValueOnce(resolved({ id: "hub-1", ...sampleInput }))
        .mockRejectedValueOnce(apiError(429, { message: "Rate limited" }));

      const inputs = [sampleInput, { ...sampleInput, field_id: "el-2" }];
      const result = await createFeedbackRecordsBatch(inputs);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].data).not.toBeNull();
      expect(result.results[0].error).toBeNull();
      expect(result.results[1].data).toBeNull();
      expect(result.results[1].error).toMatchObject({ status: 429, message: "429 Rate limited" });
    });
  });

  describe("getFeedbackRecordTenant", () => {
    test("returns config error when getHubClient returns null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);

      const result = await getFeedbackRecordTenant("0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8");

      expect(result).toEqual({
        data: null,
        error: { status: 0, message: NO_CONFIG_MESSAGE, detail: NO_CONFIG_MESSAGE },
      });
      expect(vi.mocked(cache.withCache)).not.toHaveBeenCalled();
    });

    test("returns cached tenant data when retrieve succeeds", async () => {
      useClient();
      vi.mocked(hub.getFeedbackRecord).mockResolvedValue(
        resolved({ id: "0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8", tenant_id: "clxx1234567890123456789012" })
      );

      const result = await getFeedbackRecordTenant("0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8");

      expect(result).toEqual({ data: { tenantId: "clxx1234567890123456789012" }, error: null });
      expect(vi.mocked(cache.withCache)).toHaveBeenCalledOnce();
      expect(vi.mocked(cache.withCache)).toHaveBeenCalledWith(
        expect.any(Function),
        createCacheKey.hub.feedbackRecordTenant("0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8"),
        60_000
      );
      expect(hub.getFeedbackRecord).toHaveBeenCalledWith({
        client,
        path: { id: "0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8" },
        throwOnError: true,
      });
    });

    test("returns error result when retrieve fails", async () => {
      useClient();
      vi.mocked(hub.getFeedbackRecord).mockRejectedValue(new Error("Network error"));

      const result = await getFeedbackRecordTenant("0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8");

      expect(result).toEqual({
        data: null,
        error: { status: 0, message: "Network error", detail: "Network error" },
      });
    });

    test("keeps the status and a readable message for a Hub error", async () => {
      useClient();
      vi.mocked(hub.getFeedbackRecord).mockRejectedValue(apiError(404, { detail: "not found" }));

      const result = await getFeedbackRecordTenant("0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8");

      expect(result.error).toEqual({
        status: 404,
        message: '404 {"detail":"not found"}',
        detail: '404 {"detail":"not found"}',
      });
    });
  });

  describe("getEnrichmentStatus", () => {
    test("scopes the status to the tenant", async () => {
      useClient();
      vi.mocked(hub.getEnrichmentStatus).mockResolvedValue(resolved({ tenant_id: "tenant-1" }));

      const result = await getEnrichmentStatus("tenant-1");

      expect(hub.getEnrichmentStatus).toHaveBeenCalledWith({
        client,
        query: { tenant_id: "tenant-1" },
        throwOnError: true,
      });
      expect(result).toEqual({ data: { tenant_id: "tenant-1" }, error: null });
    });
  });

  describe("taxonomy wrappers", () => {
    test("returns config errors when the Hub client is disabled", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);
      const disabled = { data: null, error: { message: NO_CONFIG_MESSAGE } };

      await expect(listTaxonomyFields("tenant-1")).resolves.toMatchObject(disabled);
      await expect(createTaxonomyRun({ ...taxonomyScope, actor_id: "user-1" })).resolves.toMatchObject(
        disabled
      );
      await expect(listTaxonomyRuns(taxonomyScope)).resolves.toMatchObject(disabled);
      await expect(getTaxonomyRun("run-1", "tenant-1")).resolves.toMatchObject(disabled);
      await expect(getActiveTaxonomyTree(taxonomyScope)).resolves.toMatchObject(disabled);
      await expect(getTaxonomyTree("run-1", "tenant-1")).resolves.toMatchObject(disabled);
      await expect(
        renameTaxonomyNode("node-1", { tenant_id: "tenant-1", actor_id: "user-1", label: "New" })
      ).resolves.toMatchObject(disabled);
      await expect(
        removeTaxonomyNode("node-1", { tenant_id: "tenant-1", actor_id: "user-1" })
      ).resolves.toMatchObject(disabled);
      await expect(listTaxonomyNodeRecords("node-1", { tenant_id: "tenant-1" })).resolves.toMatchObject(
        disabled
      );
      await expect(listTaxonomyNodeRecordCounts("run-1", "tenant-1")).resolves.toMatchObject(disabled);
    });

    test("calls the typed taxonomy operations with scoped arguments", async () => {
      useClient();
      for (const operation of [
        hub.listTaxonomyFields,
        hub.createTaxonomyRun,
        hub.listTaxonomyRuns,
        hub.getTaxonomyRun,
        hub.getActiveTaxonomyTree,
        hub.getTaxonomyRunTree,
        hub.renameTaxonomyNode,
        hub.removeTaxonomyNode,
        hub.listTaxonomyNodeRecords,
        hub.countTaxonomyNodeRecords,
      ]) {
        vi.mocked(operation).mockResolvedValue(resolved({}));
      }

      // The SDK owns path building and URL-encoding, so ids are passed through verbatim (note the spaces
      // in "run 1"/"node 1") instead of being pre-encoded by the service.
      await listTaxonomyFields("tenant-1");
      await createTaxonomyRun({ ...taxonomyScope, field_label: "Question?", actor_id: "user-1" });
      await listTaxonomyRuns({ ...taxonomyScope, limit: 5 });
      await getTaxonomyRun("run 1", "tenant-1");
      await getActiveTaxonomyTree(taxonomyScope);
      await getTaxonomyTree("run 1", "tenant-1");
      await renameTaxonomyNode("node 1", { tenant_id: "tenant-1", actor_id: "user-1", label: "Renamed" });
      await removeTaxonomyNode("node 1", { tenant_id: "tenant-1", actor_id: "user-1" });
      await listTaxonomyNodeRecords("node 1", { tenant_id: "tenant-1", limit: 25 });
      await listTaxonomyNodeRecordCounts("run 1", "tenant-1");

      const tenant = { tenant_id: "tenant-1" };
      expect(hub.listTaxonomyFields).toHaveBeenCalledWith({ client, query: tenant, throwOnError: true });
      expect(hub.createTaxonomyRun).toHaveBeenCalledWith({
        client,
        body: { ...taxonomyScope, field_label: "Question?", actor_id: "user-1" },
        throwOnError: true,
      });
      expect(hub.listTaxonomyRuns).toHaveBeenCalledWith({
        client,
        query: { ...taxonomyScope, limit: 5 },
        throwOnError: true,
      });
      expect(hub.getTaxonomyRun).toHaveBeenCalledWith({
        client,
        path: { run_id: "run 1" },
        query: tenant,
        throwOnError: true,
      });
      expect(hub.getActiveTaxonomyTree).toHaveBeenCalledWith({
        client,
        query: taxonomyScope,
        throwOnError: true,
      });
      expect(hub.getTaxonomyRunTree).toHaveBeenCalledWith({
        client,
        path: { run_id: "run 1" },
        query: tenant,
        throwOnError: true,
      });
      expect(hub.renameTaxonomyNode).toHaveBeenCalledWith({
        client,
        path: { node_id: "node 1" },
        body: { tenant_id: "tenant-1", actor_id: "user-1", label: "Renamed" },
        throwOnError: true,
      });
      expect(hub.removeTaxonomyNode).toHaveBeenCalledWith({
        client,
        path: { node_id: "node 1" },
        query: { tenant_id: "tenant-1", actor_id: "user-1" },
        throwOnError: true,
      });
      expect(hub.listTaxonomyNodeRecords).toHaveBeenCalledWith({
        client,
        path: { node_id: "node 1" },
        query: { tenant_id: "tenant-1", limit: 25 },
        throwOnError: true,
      });
      expect(hub.countTaxonomyNodeRecords).toHaveBeenCalledWith({
        client,
        path: { run_id: "run 1" },
        query: tenant,
        throwOnError: true,
      });
    });

    test("preserves an empty source_id in taxonomy scope (the no-source bucket)", async () => {
      useClient();
      vi.mocked(hub.getActiveTaxonomyTree).mockResolvedValue(resolved({ run: {}, root: null }));
      vi.mocked(hub.listTaxonomyRuns).mockResolvedValue(resolved({ data: [] }));

      const noSourceScope = { ...taxonomyScope, source_id: "" };
      await getActiveTaxonomyTree(noSourceScope);
      await listTaxonomyRuns({ ...noSourceScope, limit: 5 });

      // source_id="" must be forwarded (not dropped) — otherwise Hub reads it as "no source
      // filter" instead of "the unattributed bucket". See Hub PR #88; the wire side is pinned in
      // `hub-client.test.ts`.
      expect(hub.getActiveTaxonomyTree).toHaveBeenCalledWith(
        expect.objectContaining({ query: { ...taxonomyScope, source_id: "" } })
      );
      expect(hub.listTaxonomyRuns).toHaveBeenCalledWith(
        expect.objectContaining({ query: { ...taxonomyScope, source_id: "", limit: 5 } })
      );
    });

    test("maps taxonomy endpoint failures to HubResult errors", async () => {
      useClient();
      vi.mocked(hub.listTaxonomyFields).mockRejectedValue(new Error("taxonomy unavailable"));

      const result = await listTaxonomyFields("tenant-1");

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 0, message: "taxonomy unavailable" });
    });

    test("logs a missing taxonomy run at debug, since it is polled", async () => {
      useClient();
      vi.mocked(hub.getTaxonomyRun).mockRejectedValue(apiError(404));

      const result = await getTaxonomyRun("run-1", "tenant-1");

      expect(result.error).toMatchObject({ status: 404 });
      expect(logger.debug).toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
