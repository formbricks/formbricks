import { beforeEach, describe, expect, test, vi } from "vitest";
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
  } as TFeedbackSourceWithMappings;
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

describe("handleFeedbackSourcePipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns early when no feedbackSources for survey", async () => {
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([]);

    await handleFeedbackSourcePipeline(mockResponse, mockSurvey, "env-1");

    expect(transformResponseToFeedbackRecords).not.toHaveBeenCalled();
    expect(mockCreateFeedbackRecordsBatch).not.toHaveBeenCalled();
    expect(updateFeedbackSource).not.toHaveBeenCalled();
  });

  test("continues when transform returns no feedback records", async () => {
    const feedbackSource = createFeedbackSource();
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([feedbackSource]);
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue([]);

    await handleFeedbackSourcePipeline(mockResponse, mockSurvey, "env-1");

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
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue(oneFeedbackRecord as any);
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: oneFeedbackRecord.map(() => ({ data: null, error: noConfigError })),
    });

    await handleFeedbackSourcePipeline(mockResponse, mockSurvey, "env-1");

    expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledWith(oneFeedbackRecord);
    expect(updateFeedbackSource).not.toHaveBeenCalled();
  });

  test("sends records to Hub and updates lastSyncAt on full success", async () => {
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue(oneFeedbackRecord as any);
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: [{ data: { id: "hub-1", ...oneFeedbackRecord[0] }, error: null }],
    });

    await handleFeedbackSourcePipeline(mockResponse, mockSurvey, "env-1");

    expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledWith(oneFeedbackRecord);
    expect(updateFeedbackSource).toHaveBeenCalledWith("conn-1", "env-1", {
      lastSyncAt: expect.any(Date),
    });
  });

  test("does not update feedbackSource when all Hub creates fail", async () => {
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue(oneFeedbackRecord as any);
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: [
        { data: null, error: { status: 500, message: "Hub unavailable", detail: "Hub unavailable" } },
      ],
    });

    await handleFeedbackSourcePipeline(mockResponse, mockSurvey, "env-1");

    expect(updateFeedbackSource).not.toHaveBeenCalled();
  });

  // A Hub outage is reported once per pipeline run at warn, and the per-record detail sits at debug.
  // Pinned because the levels are an operator-visible contract, not an implementation detail: the
  // per-record line used to be error, which made a handled failure look like an unhandled fault and
  // reported one outage 2N+1 times. Anyone alerting on this path reads the warn.
  test("reports a Hub outage once at warn, with per-record detail at debug", async () => {
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue(oneFeedbackRecord as any);
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: [
        { data: null, error: { status: 500, message: "Hub unavailable", detail: "Hub unavailable" } },
      ],
    });

    await handleFeedbackSourcePipeline(mockResponse, mockSurvey, "env-1");

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
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue(oneFeedbackRecord as any);
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: [{ data: null, error: { status: 409, message: "conflict", detail: "" } }],
    });
    mockListFeedbackRecords.mockResolvedValue({
      data: { data: [{ id: "existing-record" }] },
      error: null,
    });
    mockUpdateFeedbackRecord.mockResolvedValue({ data: { id: "existing-record" }, error: null });

    await handleFeedbackSourcePipeline(mockResponse, mockSurvey, "env-1");

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
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue(twoRecords as any);
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: [
        { data: { id: "hub-1" }, error: null },
        { data: null, error: { status: 429, message: "Rate limited", detail: "Rate limited" } },
      ],
    });

    await handleFeedbackSourcePipeline(mockResponse, mockSurvey, "env-1");

    expect(updateFeedbackSource).toHaveBeenCalledWith("conn-1", "env-1", {
      lastSyncAt: expect.any(Date),
    });
  });

  test("does not update feedbackSource when transform throws", async () => {
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([createFeedbackSource()]);
    vi.mocked(transformResponseToFeedbackRecords).mockImplementation(() => {
      throw new Error("Transform failed");
    });

    await handleFeedbackSourcePipeline(mockResponse, mockSurvey, "env-1");

    expect(updateFeedbackSource).not.toHaveBeenCalled();
  });
});
