import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

vi.mock("server-only", () => ({}));

const mockCreateFeedbackRecordsBatch = vi.fn();
// reconcile.ts reaches for these two on the 409 path. Without them in the mock the whole path
// throws "not a function" the moment a conflict appears, which is exactly the case ENG-2058 adds.
const mockListFeedbackRecords = vi.fn();
const mockUpdateFeedbackRecord = vi.fn();

vi.mock("@/modules/hub", () => ({
  createFeedbackRecordsBatch: (...args: unknown[]) => mockCreateFeedbackRecordsBatch(...args),
  listFeedbackRecords: (...args: unknown[]) => mockListFeedbackRecords(...args),
  updateFeedbackRecord: (...args: unknown[]) => mockUpdateFeedbackRecord(...args),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./service", () => ({
  getFeedbackSourcesBySurveyId: vi.fn(),
  updateFeedbackSource: vi.fn(),
}));

vi.mock("./transform", () => ({
  transformResponseToFeedbackRecords: vi.fn(),
}));

const { getFeedbackSourcesBySurveyId, updateFeedbackSource } = await import("./service");
const { transformResponseToFeedbackRecords } = await import("./transform");
const { handleFeedbackSourcePipeline } = await import("./pipeline-handler");

const mockResponse = {
  id: "resp-1",
  createdAt: new Date("2026-02-24T10:00:00.000Z"),
  surveyId: "survey-1",
  data: { "el-1": "answer" },
} as unknown as TResponse;

const mockSurvey = {
  id: "survey-1",
  name: "Test Survey",
  blocks: [{ id: "block-1", name: "Block", elements: [{ id: "el-1", headline: { default: "Question?" } }] }],
} as unknown as TSurvey;

function createFeedbackSource(
  overrides: Partial<Pick<TFeedbackSourceWithMappings, "id" | "formbricksMappings" | "importMode">> = {}
): TFeedbackSourceWithMappings {
  return {
    id: "conn-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Test FeedbackSource",
    type: "formbricks_survey",
    status: "active",
    importMode: "completedOnly",
    elementScope: "specific" as const,
    workspaceId: "env-1",
    feedbackDirectoryId: "frd-1",
    lastSyncAt: null,
    createdBy: null,
    formbricksMappings: [
      {
        id: "map-1",
        createdAt: new Date(),
        feedbackSourceId: "conn-1",
        workspaceId: "env-1",
        surveyId: "survey-1",
        elementId: "el-1",
        hubFieldType: "rating",
        customFieldLabel: null,
      },
    ],
    fieldMappings: [],
    ...overrides,
  };
}

const oneFeedbackRecord = [
  {
    field_id: "el-1",
    field_type: "rating" as const,
    source_type: "formbricks_survey",
    source_id: "survey-1",
    source_name: "Test Survey",
    field_label: "Question?",
    value_number: 5,
    collected_at: "2026-02-24T10:00:00.000Z",
  },
];

const noConfigError = {
  status: 0,
  message: "HUB_API_KEY is not set; Hub integration is disabled.",
  detail: "HUB_API_KEY is not set; Hub integration is disabled.",
};

/**
 * Runs the pipeline to completion with fake timers, so the retry backoff costs no wall-clock time.
 * `runAllTimersAsync` keeps flushing until no timer is left, which covers every backoff step.
 */
const runPipeline = async (): Promise<void> => {
  const run = handleFeedbackSourcePipeline(mockResponse, mockSurvey, "env-1");
  await vi.runAllTimersAsync();
  await run;
};

describe("handleFeedbackSourcePipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFeedbackRecordsBatch.mockReset();
    mockListFeedbackRecords.mockReset();
    mockUpdateFeedbackRecord.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns early when no feedbackSources for survey", async () => {
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([]);

    await runPipeline();

    expect(transformResponseToFeedbackRecords).not.toHaveBeenCalled();
    expect(mockCreateFeedbackRecordsBatch).not.toHaveBeenCalled();
    expect(updateFeedbackSource).not.toHaveBeenCalled();
  });

  test("continues when transform returns no feedback records", async () => {
    const feedbackSource = createFeedbackSource();
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([feedbackSource]);
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue([]);

    await runPipeline();

    expect(transformResponseToFeedbackRecords).toHaveBeenCalledWith(
      mockResponse,
      mockSurvey,
      feedbackSource.formbricksMappings,
      "frd-1"
    );
    expect(mockCreateFeedbackRecordsBatch).not.toHaveBeenCalled();
    expect(updateFeedbackSource).not.toHaveBeenCalled();
  });

  test("does not update feedbackSource when Hub returns no-config (HUB_API_KEY not set)", async () => {
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
    vi.mocked(transformResponseToFeedbackRecords, { partial: true, deep: true }).mockReturnValue(
      oneFeedbackRecord
    );
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: oneFeedbackRecord.map(() => ({ data: null, error: noConfigError })),
    });

    await runPipeline();

    expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledWith(oneFeedbackRecord);
    expect(updateFeedbackSource).not.toHaveBeenCalled();
  });

  test("sends records to Hub and updates lastSyncAt on full success", async () => {
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
    vi.mocked(transformResponseToFeedbackRecords, { partial: true, deep: true }).mockReturnValue(
      oneFeedbackRecord
    );
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: [{ data: { id: "hub-1", ...oneFeedbackRecord[0] }, error: null }],
    });

    await runPipeline();

    expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledWith(oneFeedbackRecord);
    expect(updateFeedbackSource).toHaveBeenCalledWith("conn-1", "env-1", {
      lastSyncAt: expect.any(Date),
    });
  });

  test("does not update feedbackSource when all Hub creates fail", async () => {
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
    vi.mocked(transformResponseToFeedbackRecords, { partial: true, deep: true }).mockReturnValue(
      oneFeedbackRecord
    );
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: [
        { data: null, error: { status: 500, message: "Hub unavailable", detail: "Hub unavailable" } },
      ],
    });

    await runPipeline();

    expect(updateFeedbackSource).not.toHaveBeenCalled();
  });

  // A Hub outage is reported once per pipeline run at warn, and the per-record detail sits at debug.
  // Pinned because the levels are an operator-visible contract, not an implementation detail: the
  // per-record line used to be error, which made a handled failure look like an unhandled fault and
  // reported one outage 2N+1 times. Anyone alerting on this path reads the warn.
  test("reports a Hub outage once at warn, with per-record detail at debug", async () => {
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
    vi.mocked(transformResponseToFeedbackRecords, { partial: true, deep: true }).mockReturnValue(
      oneFeedbackRecord
    );
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: [
        { data: null, error: { status: 500, message: "Hub unavailable", detail: "Hub unavailable" } },
      ],
    });

    await runPipeline();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ feedbackSourceId: "conn-1", successes: 0, failures: 1 }),
      expect.stringContaining("1/1 FeedbackRecords failed to send")
    );

    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ feedbackSourceId: "conn-1", feedbackRecordIndex: 0 }),
      expect.any(String)
    );

    expect(logger.error).not.toHaveBeenCalled();
  });

  /**
   * ENG-2058, end to end through the pipeline rather than against reconcile directly.
   *
   * This is the defect the ticket's setting exposes: a response imported as a partial, then
   * finished with a changed answer, used to 409 on every field it already had and leave Hub holding
   * the old value. A 409 must reach Hub as an update, count as a success, and never surface as a
   * failure — the reconcile unit tests cannot prove the pipeline actually wires that up.
   */
  test("a conflicting record is corrected in Hub, not counted as a failure", async () => {
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
    vi.mocked(transformResponseToFeedbackRecords, { partial: true, deep: true }).mockReturnValue(
      oneFeedbackRecord
    );
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: [{ data: null, error: { status: 409, message: "conflict", detail: "" } }],
    });
    mockListFeedbackRecords.mockResolvedValue({
      data: { data: [{ id: "existing-record" }] },
      error: null,
    });
    mockUpdateFeedbackRecord.mockResolvedValue({ data: { id: "existing-record" }, error: null });

    await runPipeline();

    expect(mockUpdateFeedbackRecord).toHaveBeenCalledWith("existing-record", expect.any(Object));
    // The tenant boundary (S1): the id patched above is only safe because the lookup was scoped.
    expect(mockListFeedbackRecords).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: "frd-1" }));
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(updateFeedbackSource).toHaveBeenCalled();
  });

  test("updates lastSyncAt on partial failure when some creates succeed", async () => {
    const twoRecords = [...oneFeedbackRecord, { ...oneFeedbackRecord[0], field_id: "el-2", value_number: 3 }];
    const baseMapping = {
      createdAt: new Date(),
      feedbackSourceId: "conn-1",
      workspaceId: "env-1",
      surveyId: "survey-1",
      hubFieldType: "rating" as const,
      customFieldLabel: null as string | null,
    };
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([
      createFeedbackSource({
        formbricksMappings: [
          { ...baseMapping, id: "m1", elementId: "el-1" },
          { ...baseMapping, id: "m2", elementId: "el-2" },
        ],
      }),
    ]);
    vi.mocked(transformResponseToFeedbackRecords, { partial: true, deep: true }).mockReturnValue(twoRecords);
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: [
        { data: { id: "hub-1" }, error: null },
        { data: null, error: { status: 429, message: "Rate limited", detail: "Rate limited" } },
      ],
    });

    await runPipeline();

    expect(updateFeedbackSource).toHaveBeenCalledWith("conn-1", "env-1", {
      lastSyncAt: expect.any(Date),
    });
  });

  test("does not update feedbackSource when transform throws", async () => {
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
    vi.mocked(transformResponseToFeedbackRecords).mockImplementation(() => {
      throw new Error("Transform failed");
    });

    await runPipeline();

    expect(updateFeedbackSource).not.toHaveBeenCalled();
  });
  /**
   * ENG-3884: the SDK no longer re-sends a create after a 5xx, a network error or a timeout, so the live
   * pipeline has to. A Hub pod that is terminating answers the first attempt badly and the next one fine.
   */
  describe("transient Hub failures", () => {
    const twoRecords = [...oneFeedbackRecord, { ...oneFeedbackRecord[0], field_id: "el-2", value_number: 3 }];
    const serverError = { status: 502, message: "502 Bad Gateway", detail: "502 Bad Gateway" };
    // A dead socket has no HTTP status: the Hub service layer reports it as status 0.
    const connectionReset = { status: 0, message: "fetch failed", detail: "fetch failed" };

    test.each([
      ["408", { status: 408, message: "408", detail: "408" }],
      ["500", { status: 500, message: "500", detail: "500" }],
      ["502", serverError],
      ["503", { status: 503, message: "503", detail: "503" }],
      ["504", { status: 504, message: "504", detail: "504" }],
      ["a connection reset", connectionReset],
      ["a timeout", { status: 0, message: "The operation timed out.", detail: "The operation timed out." }],
    ])("re-sends only the records that failed with %s, until they land", async (_label, error) => {
      vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
      vi.mocked(transformResponseToFeedbackRecords, { partial: true, deep: true }).mockReturnValue(
        twoRecords
      );
      mockCreateFeedbackRecordsBatch
        .mockResolvedValueOnce({
          results: [
            { data: { id: "hub-1" }, error: null },
            { data: null, error },
          ],
        })
        .mockResolvedValueOnce({ results: [{ data: { id: "hub-2" }, error: null }] });

      await runPipeline();

      expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledTimes(2);
      expect(mockCreateFeedbackRecordsBatch).toHaveBeenNthCalledWith(2, [twoRecords[1]]);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ feedbackSourceId: "conn-1", successes: 2 }),
        expect.stringContaining("Successfully sent 2 FeedbackRecords")
      );
      expect(updateFeedbackSource).toHaveBeenCalledTimes(1);
    });

    test("a re-send that 409s because the first attempt did land is reconciled, not a failure", async () => {
      vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
      vi.mocked(transformResponseToFeedbackRecords, { partial: true, deep: true }).mockReturnValue(
        oneFeedbackRecord
      );
      mockCreateFeedbackRecordsBatch
        .mockResolvedValueOnce({ results: [{ data: null, error: connectionReset }] })
        .mockResolvedValueOnce({
          results: [{ data: null, error: { status: 409, message: "conflict", detail: "" } }],
        });
      mockListFeedbackRecords.mockResolvedValue({ data: { data: [{ id: "landed-record" }] }, error: null });
      mockUpdateFeedbackRecord.mockResolvedValue({ data: { id: "landed-record" }, error: null });

      await runPipeline();

      expect(mockUpdateFeedbackRecord).toHaveBeenCalledWith("landed-record", expect.any(Object));
      expect(mockListFeedbackRecords).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: "frd-1" }));
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ reconciled: 1, successes: 1 }),
        expect.any(String)
      );
      expect(updateFeedbackSource).toHaveBeenCalledTimes(1);
    });

    test("retries are bounded, and a record that keeps failing is reported once at warn", async () => {
      vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
      vi.mocked(transformResponseToFeedbackRecords, { partial: true, deep: true }).mockReturnValue(
        oneFeedbackRecord
      );
      mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [{ data: null, error: serverError }] });

      await runPipeline();

      // One first attempt plus the bounded retries — never an open-ended loop.
      expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ feedbackSourceId: "conn-1", successes: 0, failures: 1, attempts: 3 }),
        expect.stringContaining("1/1 FeedbackRecords failed to send")
      );
      expect(updateFeedbackSource).not.toHaveBeenCalled();
    });

    test("waits between attempts instead of re-sending into the same blip", async () => {
      vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
      vi.mocked(transformResponseToFeedbackRecords, { partial: true, deep: true }).mockReturnValue(
        oneFeedbackRecord
      );
      mockCreateFeedbackRecordsBatch
        .mockResolvedValueOnce({ results: [{ data: null, error: serverError }] })
        .mockResolvedValueOnce({ results: [{ data: null, error: serverError }] })
        .mockResolvedValueOnce({ results: [{ data: { id: "hub-1" }, error: null }] });

      const run = handleFeedbackSourcePipeline(mockResponse, mockSurvey, "env-1");
      await vi.advanceTimersByTimeAsync(0);
      expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(999);
      expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(3_999);
      expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1);
      await run;
      expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledTimes(3);
    });

    test("a Hub that hangs until the attempt times out is not retried: the worker is not held for minutes", async () => {
      vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
      vi.mocked(transformResponseToFeedbackRecords, { partial: true, deep: true }).mockReturnValue(
        oneFeedbackRecord
      );
      // The SDK's per-attempt timeout is 60 s; the attempt fails only once it has run out.
      mockCreateFeedbackRecordsBatch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  results: [
                    { data: null, error: { status: 0, message: "The operation timed out.", detail: "" } },
                  ],
                }),
              60_000
            )
          )
      );

      await runPipeline();

      expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ failures: 1, attempts: 1 }),
        expect.any(String)
      );
    });

    test("a backoff timer that fires after the budget is spent starts no further request", async () => {
      vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
      vi.mocked(transformResponseToFeedbackRecords, { partial: true, deep: true }).mockReturnValue(
        oneFeedbackRecord
      );
      // The first attempt fails at 13.5 s, inside the budget, so a 1 s backoff is allowed to start.
      mockCreateFeedbackRecordsBatch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ results: [{ data: null, error: serverError }] }), 13_500)
          )
      );
      // A stalled event loop: by the time the backoff timer fires, the wall clock has passed 15 s.
      setTimeout(() => vi.setSystemTime(Date.now() + 5_000), 14_000);

      await runPipeline();

      expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ failures: 1, attempts: 1 }),
        expect.stringContaining("1/1 FeedbackRecords failed to send")
      );
    });

    test.each([
      ["a 400 validation error", { status: 400, message: "400 invalid", detail: "400 invalid" }],
      // The SDK has already re-sent a 429 itself, honouring Retry-After.
      ["a 429 the SDK already retried", { status: 429, message: "Rate limited", detail: "Rate limited" }],
      [
        "a tenant purge in progress",
        { status: 409, message: "409", detail: "", code: "tenant_write_conflict" },
      ],
      ["Hub not being configured", noConfigError],
    ])("does not retry %s: re-sending cannot change the answer", async (_label, error) => {
      vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
      vi.mocked(transformResponseToFeedbackRecords, { partial: true, deep: true }).mockReturnValue(
        oneFeedbackRecord
      );
      mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [{ data: null, error }] });

      await runPipeline();

      expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ failures: 1, attempts: 1 }),
        expect.any(String)
      );
    });
  });
});
