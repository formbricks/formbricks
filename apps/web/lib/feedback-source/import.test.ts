import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";
import { TSurvey } from "@formbricks/types/surveys/types";
import { importHistoricalResponses } from "./import";

vi.mock("../response/service", () => ({
  getResponses: vi.fn(),
}));

vi.mock("@/modules/hub", () => ({
  createFeedbackRecordsBatch: vi.fn(),
}));
vi.mock("./reconcile", () => ({
  reconcileFeedbackRecords: vi.fn(),
}));

vi.mock("./transform", () => ({
  transformResponseToFeedbackRecords: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { getResponses } = vi.mocked(await import("../response/service"));
const { reconcileFeedbackRecords } = vi.mocked(await import("./reconcile"));
const { transformResponseToFeedbackRecords } = vi.mocked(await import("./transform"));
const { logger } = await import("@formbricks/logger");

const ENV_ID = "clxxxxxxxxxxxxxxxx001";
const FEEDBACK_SOURCE_ID = "clxxxxxxxxxxxxxxxx002";
const SURVEY_ID = "clxxxxxxxxxxxxxxxx003";
const NOW = new Date("2026-02-24T10:00:00.000Z");

const mockFeedbackSource: TFeedbackSourceWithMappings = {
  id: FEEDBACK_SOURCE_ID,
  createdAt: NOW,
  updatedAt: NOW,
  name: "Test FeedbackSource",
  type: "formbricks_survey",
  status: "active",
  importMode: "completedOnly",
  elementScope: "specific" as const,
  workspaceId: ENV_ID,
  feedbackDirectoryId: "clxxxxxxxxxxxxxxxx004",
  lastSyncAt: null,
  createdBy: null,
  creatorName: null,
  formbricksMappings: [
    {
      id: "mapping-1",
      createdAt: NOW,
      feedbackSourceId: FEEDBACK_SOURCE_ID,
      workspaceId: ENV_ID,
      surveyId: SURVEY_ID,
      elementId: "el-1",
      hubFieldType: "text",
      customFieldLabel: null,
    },
  ],
  fieldMappings: [],
};

const mockSurvey = { id: SURVEY_ID, blocks: [] } as unknown as TSurvey;

describe("importHistoricalResponses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws InvalidInputError for non-formbricks feedbackSource", async () => {
    const csvFeedbackSource = { ...mockFeedbackSource, type: "csv" as const };

    await expect(importHistoricalResponses(csvFeedbackSource, mockSurvey)).rejects.toThrow(InvalidInputError);
    expect(getResponses).not.toHaveBeenCalled();
  });

  test("returns zeros when there are no responses", async () => {
    getResponses.mockResolvedValue([]);

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    expect(result).toEqual({ successes: 0, failures: 0, skipped: 0 });
  });

  test("counts successes and skipped correctly", async () => {
    const mockResponses = [{ id: "r1" }, { id: "r2" }, { id: "r3" }];
    getResponses.mockResolvedValueOnce(mockResponses as never);
    getResponses.mockResolvedValueOnce([]);

    transformResponseToFeedbackRecords
      .mockReturnValueOnce([{ field: "record1" }] as never)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ field: "record3" }] as never);

    reconcileFeedbackRecords.mockResolvedValue({ created: 2, reconciled: 0, superseded: 0, failures: [] });

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    expect(result.successes).toBe(2);
    expect(result.failures).toBe(0);
    expect(result.skipped).toBe(1);
  });

  /**
   * An import can hold a page of responses for a long time, so it passes the moment it read them and
   * lets reconcile skip records the live pipeline has corrected since. Without this argument the
   * guard in reconcile is dead code and the import silently reverts newer answers.
   */
  test("tells reconcile when its data was read, so it cannot revert newer writes", async () => {
    getResponses.mockResolvedValueOnce([{ id: "r1" }] as never);
    getResponses.mockResolvedValueOnce([]);
    transformResponseToFeedbackRecords.mockReturnValue([{ field: "record" }] as never);
    reconcileFeedbackRecords.mockResolvedValue({ created: 1, reconciled: 0, superseded: 0, failures: [] });

    const before = new Date();
    await importHistoricalResponses(mockFeedbackSource, mockSurvey);
    const after = new Date();

    const [, , options] = reconcileFeedbackRecords.mock.calls[0];
    const snapshotAt = options?.snapshotAt;
    expect(snapshotAt).toBeInstanceOf(Date);
    // Taken before the read, so it can never claim the data is fresher than it is.
    expect(snapshotAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(snapshotAt!.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test("a record superseded by a newer write still counts as a success", async () => {
    getResponses.mockResolvedValueOnce([{ id: "r1" }] as never);
    getResponses.mockResolvedValueOnce([]);
    transformResponseToFeedbackRecords.mockReturnValue([{ field: "record" }] as never);
    reconcileFeedbackRecords.mockResolvedValue({ created: 0, reconciled: 0, superseded: 1, failures: [] });

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    // Hub holds a newer value, so the record is correct — not a failure and not a skip.
    expect(result.successes).toBe(1);
    expect(result.failures).toBe(0);
  });

  test("counts failures from Hub API errors", async () => {
    const mockResponses = [{ id: "r1" }];
    getResponses.mockResolvedValueOnce(mockResponses as never);
    getResponses.mockResolvedValueOnce([]);

    transformResponseToFeedbackRecords.mockReturnValue([{ field: "record" }] as never);

    reconcileFeedbackRecords.mockResolvedValue({
      created: 0,
      reconciled: 0,
      superseded: 0,
      failures: [{ index: 0, error: { status: 500 } }],
    });

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    expect(result.successes).toBe(0);
    expect(result.failures).toBe(1);
  });

  // Behaviour change (ENG-2058): a record that already existed used to be counted as "skipped",
  // which is how silently keeping a stale value read as normal. Reconcile updates it instead, so it
  // is a success. `skipped` is now only ever about mapping.
  test("counts a reconciled record as a success, not a skip", async () => {
    const mockResponses = [{ id: "r1" }, { id: "r2" }, { id: "r3" }];
    getResponses.mockResolvedValueOnce(mockResponses as never);
    getResponses.mockResolvedValueOnce([]);

    transformResponseToFeedbackRecords.mockReturnValue([{ field: "record" }] as never);

    reconcileFeedbackRecords.mockResolvedValue({
      created: 1,
      reconciled: 1,
      superseded: 0,
      failures: [{ index: 0, error: { status: 500 } }],
    });

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    expect(result.successes).toBe(2);
    expect(result.failures).toBe(1);
    expect(result.skipped).toBe(0);
  });

  test("paginates through responses in batches", async () => {
    const batch1 = Array.from({ length: 50 }, (_, i) => ({ id: `r${i}` }));
    const batch2 = [{ id: "r50" }];

    getResponses.mockResolvedValueOnce(batch1 as never);
    getResponses.mockResolvedValueOnce(batch2 as never);
    getResponses.mockResolvedValueOnce([]);

    transformResponseToFeedbackRecords.mockReturnValue([{ field: "record" }] as never);
    reconcileFeedbackRecords.mockResolvedValue({ created: 1, reconciled: 0, superseded: 0, failures: [] });

    await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    expect(getResponses).toHaveBeenCalledWith(SURVEY_ID, 50, 0, { finished: true });
    expect(getResponses).toHaveBeenCalledWith(SURVEY_ID, 50, 50, { finished: true });
  });

  // The whole point of ENG-2058: the historical import used to pull every response, while the live
  // pipeline only ever ran on responseFinished. These two pin that they now agree.
  test("completedOnly asks the response service for finished responses only", async () => {
    getResponses.mockResolvedValueOnce([]);

    await importHistoricalResponses({ ...mockFeedbackSource, importMode: "completedOnly" }, mockSurvey);

    expect(getResponses).toHaveBeenCalledWith(SURVEY_ID, 50, 0, { finished: true });
  });

  test("all leaves the response query unfiltered so partials are included", async () => {
    getResponses.mockResolvedValueOnce([]);

    await importHistoricalResponses({ ...mockFeedbackSource, importMode: "all" }, mockSurvey);

    expect(getResponses).toHaveBeenCalledWith(SURVEY_ID, 50, 0, undefined);
  });

  test("does not call Hub API when all responses are skipped", async () => {
    const mockResponses = [{ id: "r1" }, { id: "r2" }];
    getResponses.mockResolvedValueOnce(mockResponses as never);
    getResponses.mockResolvedValueOnce([]);

    transformResponseToFeedbackRecords.mockReturnValue([]);

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    expect(reconcileFeedbackRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ successes: 0, failures: 0, skipped: 2 });
  });

  test("contains a transform failure instead of aborting the whole import (ENG-1939)", async () => {
    const mockResponses = [{ id: "r1" }, { id: "r2" }];
    getResponses.mockResolvedValueOnce(mockResponses as never);
    getResponses.mockResolvedValueOnce([]);

    // First response throws (e.g. malformed choice element); the second is healthy.
    transformResponseToFeedbackRecords
      .mockImplementationOnce(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'some')");
      })
      .mockReturnValueOnce([{ field: "record2" }] as never);

    reconcileFeedbackRecords.mockResolvedValue({ created: 1, reconciled: 0, superseded: 0, failures: [] });

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    // The healthy response is still imported; the throwing one is contained and logged.
    expect(result.successes).toBe(1);
    expect(reconcileFeedbackRecords).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.error)).toHaveBeenCalledTimes(1);
  });
});
