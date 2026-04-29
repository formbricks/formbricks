import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createFeedbackRecord,
  createFeedbackRecordsBatch,
  listFeedbackRecords,
  retrieveFeedbackRecord,
  semanticSearchFeedbackRecords,
  updateFeedbackRecord,
} from "./service";
import type { FeedbackRecordCreateParams } from "./types";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    HUB_API_KEY: "",
    HUB_API_URL: "https://hub.test",
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/env", () => ({
  env: mockEnv,
}));

vi.mock("./hub-client", () => ({
  getHubClient: vi.fn(),
}));

const { getHubClient } = await import("./hub-client");

const sampleInput: FeedbackRecordCreateParams = {
  field_id: "el-1",
  field_type: "rating",
  source_type: "formbricks_survey",
  source_id: "survey-1",
  source_name: "Test Survey",
  field_label: "Question?",
  value_number: 5,
  collected_at: "2026-02-24T10:00:00.000Z",
};

describe("hub service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mockEnv.HUB_API_KEY = "";
    mockEnv.HUB_API_URL = "https://hub.test";
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

      const result = await listFeedbackRecords({ tenant_id: "env-1", limit: 50, offset: 0 });

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

    test("returns data when called without params", async () => {
      const listResponse = { data: [], total: 0, limit: 50, offset: 0 };
      const listFn = vi.fn().mockResolvedValue(listResponse);
      vi.mocked(getHubClient).mockReturnValue({
        feedbackRecords: { list: listFn },
      } as any);

      const result = await listFeedbackRecords();

      expect(result.error).toBeNull();
      expect(result.data).toEqual(listResponse);
      expect(listFn).toHaveBeenCalledWith(undefined);
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
    test("returns error result when HUB_API_KEY is not set", async () => {
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

    test("returns semantic search results when Hub succeeds", async () => {
      mockEnv.HUB_API_KEY = "test-key";
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
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(searchResponse),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await semanticSearchFeedbackRecords({
        tenant_id: "env-1",
        query: "slow checkout",
        limit: 10,
        min_score: 0.7,
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual(searchResponse);
      expect(fetchMock).toHaveBeenCalledWith(
        new URL("https://hub.test/v1/feedback-records/search/semantic?limit=10&min_score=0.7"),
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer test-key",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: "slow checkout",
            tenant_id: "env-1",
          }),
        })
      );
    });

    test("returns unavailable error when Hub embeddings are not configured", async () => {
      mockEnv.HUB_API_KEY = "test-key";
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          json: vi.fn().mockResolvedValue({ detail: "Embeddings are not configured" }),
        })
      );

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

    test("returns error result when fetch throws", async () => {
      mockEnv.HUB_API_KEY = "test-key";
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

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
});
