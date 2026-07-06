import { beforeEach, describe, expect, test, vi } from "vitest";
import { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

vi.mock("server-only", () => ({}));

const mockCreateFeedbackRecordsBatch = vi.fn();

vi.mock("@/modules/hub", () => ({
  createFeedbackRecordsBatch: (...args: unknown[]) => mockCreateFeedbackRecordsBatch(...args),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
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
  overrides: Partial<Pick<TFeedbackSourceWithMappings, "id" | "formbricksMappings">> = {}
): TFeedbackSourceWithMappings {
  return {
    id: "conn-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Test FeedbackSource",
    type: "formbricks_survey",
    status: "active",
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
