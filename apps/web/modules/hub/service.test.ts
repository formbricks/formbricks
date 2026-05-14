import { beforeEach, describe, expect, test, vi } from "vitest";
import { createCacheKey } from "@formbricks/cache";
import FormbricksHub from "@formbricks/hub";
import {
  createFeedbackRecord,
  createFeedbackRecordsBatch,
  getFeedbackRecordTenant,
  listFeedbackRecords,
  retrieveFeedbackRecord,
  semanticSearchFeedbackRecords,
  updateFeedbackRecord,
} from "./service";
import type { FeedbackRecordCreateParams } from "./types";

vi.mock("@formbricks/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@formbricks/hub", () => ({
  default: {
    APIError: class APIError extends Error {
      status: number;

      constructor(message: string, status: number) {
        super(message);
        this.status = status;
      }
    },
  },
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

describe("hub service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createFeedbackRecord", () => {
    test("returns error result when getHubClient returns null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);

      const result = await createFeedbackRecord(sampleInput);

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({
        status: 0,
        message: "HUB_API_KEY is not set; Hub integration is disabled.",
      });
    });

    test("returns data when client.create succeeds", async () => {
      const created = { id: "hub-1", ...sampleInput };
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: { create: vi.fn().mockResolvedValue(created) },
      } as any);

      const result = await createFeedbackRecord(sampleInput);

      expect(result.error).toBeNull();
      expect(result.data).toEqual(created);
    });

    test("returns error result when client.create throws", async () => {
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: { create: vi.fn().mockRejectedValue(new Error("Network error")) },
      } as any);

      const result = await createFeedbackRecord(sampleInput);

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ message: "Network error" });
    });

    test("reads status from a foreign error class (simulates dual module scope)", async () => {
      // Simulates the SDK being loaded into a different module scope under Next dev/Turbopack:
      // the thrown error is NOT instanceof the FormbricksHub.APIError reference captured in service.ts.
      class ForeignConflictError extends Error {
        readonly status = 409;
      }
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: {
          create: vi.fn().mockRejectedValue(new ForeignConflictError("duplicate submission_id")),
        },
      } as any);

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
      expect(result.error).toMatchObject({
        status: 0,
        message: "HUB_API_KEY is not set; Hub integration is disabled.",
      });
    });

    test("returns data when client.list succeeds", async () => {
      const listResponse = {
        data: [{ id: "rec-1", field_id: "el-1", field_type: "rating" }],
        total: 1,
        limit: 50,
        offset: 0,
      };
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: { list: vi.fn().mockResolvedValue(listResponse) },
      } as any);

      const result = await listFeedbackRecords({ tenant_id: "env-1", limit: 50 });

      expect(result.error).toBeNull();
      expect(result.data).toEqual(listResponse);
    });

    test("returns error result when client.list throws", async () => {
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: { list: vi.fn().mockRejectedValue(new Error("Network error")) },
      } as any);

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

    test("returns data on success", async () => {
      const record = { id: "rec-1", field_id: "f1" };
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: { retrieve: vi.fn().mockResolvedValue(record) },
      } as any);
      const result = await retrieveFeedbackRecord("rec-1");
      expect(result.data).toEqual(record);
      expect(result.error).toBeNull();
    });

    test("returns error on throw", async () => {
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: { retrieve: vi.fn().mockRejectedValue(new Error("Not found")) },
      } as any);
      const result = await retrieveFeedbackRecord("rec-1");
      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ message: "Not found" });
    });
  });

  describe("semanticSearchFeedbackRecords", () => {
    test("returns error result when getHubClient returns null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);

      const result = await semanticSearchFeedbackRecords({
        tenant_id: "env-1",
        query: "slow checkout",
      });

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({
        status: 0,
        message: "HUB_API_KEY is not set; Hub integration is disabled.",
      });
    });

    test("returns data when client.search.performSemanticSearch succeeds", async () => {
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
      const performSemanticSearch = vi.fn().mockResolvedValue(searchResponse);
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: { search: { performSemanticSearch } },
      } as any);

      const input = {
        tenant_id: "env-1",
        query: "slow checkout",
        limit: 10,
        min_score: 0.7,
      };
      const result = await semanticSearchFeedbackRecords(input);

      expect(result.error).toBeNull();
      expect(result.data).toEqual(searchResponse);
      expect(performSemanticSearch).toHaveBeenCalledWith(input);
    });

    test("returns error with status when client.search.performSemanticSearch throws APIError", async () => {
      const apiError = new (FormbricksHub.APIError as any)("Embeddings are not configured", 503);
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: {
          search: { performSemanticSearch: vi.fn().mockRejectedValue(apiError) },
        },
      } as any);

      const result = await semanticSearchFeedbackRecords({
        tenant_id: "env-1",
        query: "slow checkout",
      });

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({
        status: 503,
        message: "Embeddings are not configured",
      });
    });

    test("returns error result when call throws non-API error", async () => {
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: {
          search: { performSemanticSearch: vi.fn().mockRejectedValue(new Error("Network error")) },
        },
      } as any);

      const result = await semanticSearchFeedbackRecords({
        tenant_id: "env-1",
        query: "slow checkout",
      });

      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ status: 0, message: "Network error" });
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
      const updated = { id: "rec-1", value_text: "new" };
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: { update: vi.fn().mockResolvedValue(updated) },
      } as any);
      const result = await updateFeedbackRecord("rec-1", { value_text: "new" });
      expect(result.data).toEqual(updated);
      expect(result.error).toBeNull();
    });

    test("returns error on throw", async () => {
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: { update: vi.fn().mockRejectedValue(new Error("Forbidden")) },
      } as any);
      const result = await updateFeedbackRecord("rec-1", { value_text: "new" });
      expect(result.data).toBeNull();
      expect(result.error).toMatchObject({ message: "Forbidden" });
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

    test("returns results per input when client creates succeed", async () => {
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: {
          create: vi
            .fn()
            .mockImplementation((input: FeedbackRecordCreateParams) =>
              Promise.resolve({ id: `hub-${input.field_id}`, ...input })
            ),
        },
      } as any);

      const inputs = [sampleInput, { ...sampleInput, field_id: "el-2" }];
      const result = await createFeedbackRecordsBatch(inputs);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].data).toMatchObject({ field_id: "el-1" });
      expect(result.results[0].error).toBeNull();
      expect(result.results[1].data).toMatchObject({ field_id: "el-2" });
      expect(result.results[1].error).toBeNull();
    });

    test("returns mixed results when some creates fail", async () => {
      const create = vi
        .fn()
        .mockResolvedValueOnce({ id: "hub-1", ...sampleInput })
        .mockRejectedValueOnce(new Error("Rate limited"));
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: { create },
      } as any);

      const inputs = [sampleInput, { ...sampleInput, field_id: "el-2" }];
      const result = await createFeedbackRecordsBatch(inputs);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].data).not.toBeNull();
      expect(result.results[0].error).toBeNull();
      expect(result.results[1].data).toBeNull();
      expect(result.results[1].error).toMatchObject({ message: "Rate limited" });
    });
  });

  describe("getFeedbackRecordTenant", () => {
    test("returns config error when getHubClient returns null", async () => {
      vi.mocked(getHubClient).mockReturnValue(null);

      const result = await getFeedbackRecordTenant("0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8");

      expect(result).toEqual({
        data: null,
        error: {
          status: 0,
          message: "HUB_API_KEY is not set; Hub integration is disabled.",
          detail: "HUB_API_KEY is not set; Hub integration is disabled.",
        },
      });
      expect(vi.mocked(cache.withCache)).not.toHaveBeenCalled();
    });

    test("returns cached tenant data when retrieve succeeds", async () => {
      const retrieve = vi.fn().mockResolvedValue({
        id: "0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8",
        tenant_id: "clxx1234567890123456789012",
      });
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: { retrieve },
      } as any);

      const result = await getFeedbackRecordTenant("0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8");

      expect(result).toEqual({
        data: { tenantId: "clxx1234567890123456789012" },
        error: null,
      });
      expect(vi.mocked(cache.withCache)).toHaveBeenCalledOnce();
      expect(vi.mocked(cache.withCache)).toHaveBeenCalledWith(
        expect.any(Function),
        createCacheKey.hub.feedbackRecordTenant("0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8"),
        60_000
      );
      expect(retrieve).toHaveBeenCalledWith("0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8");
    });

    test("returns error result when retrieve fails", async () => {
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: {
          retrieve: vi.fn().mockRejectedValue(new Error("Network error")),
        },
      } as any);

      const result = await getFeedbackRecordTenant("0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8");

      expect(result).toEqual({
        data: null,
        error: {
          status: 0,
          message: "Network error",
          detail: "Network error",
        },
      });
    });
  });
});
