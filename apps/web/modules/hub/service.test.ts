import { beforeEach, describe, expect, test, vi } from "vitest";
import { createFeedbackRecord, createFeedbackRecordsBatch } from "./service";
import type { FeedbackRecordCreateParams } from "./types";

vi.mock("@formbricks/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("./hub-client", () => ({
  getHubClient: vi.fn(),
}));

const { getHubClient } = await import("./hub-client");

const sampleInput: FeedbackRecordCreateParams = {
  field_id: "el-1",
  field_type: "rating",
  source_type: "formbricks",
  source_id: "survey-1",
  source_name: "Test Survey",
  field_label: "Question?",
  value_number: 5,
  collected_at: "2026-02-24T10:00:00.000Z",
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
