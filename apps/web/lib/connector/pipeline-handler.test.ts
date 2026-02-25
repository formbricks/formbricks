import { beforeEach, describe, expect, test, vi } from "vitest";
import { TConnectorWithMappings } from "@formbricks/types/connector";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

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
  getConnectorsBySurveyId: vi.fn(),
  updateConnector: vi.fn(),
}));

vi.mock("./transform", () => ({
  transformResponseToFeedbackRecords: vi.fn(),
}));

const { getConnectorsBySurveyId, updateConnector } = await import("./service");
const { transformResponseToFeedbackRecords } = await import("./transform");
const { handleConnectorPipeline } = await import("./pipeline-handler");

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

function createConnector(
  overrides: Partial<Pick<TConnectorWithMappings, "id" | "formbricksMappings">> = {}
): TConnectorWithMappings {
  return {
    id: "conn-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Test Connector",
    type: "formbricks",
    status: "active",
    environmentId: "env-1",
    lastSyncAt: null,
    errorMessage: null,
    formbricksMappings: [
      {
        id: "map-1",
        createdAt: new Date(),
        connectorId: "conn-1",
        environmentId: "env-1",
        surveyId: "survey-1",
        elementId: "el-1",
        hubFieldType: "rating",
        customFieldLabel: null,
      },
    ],
    fieldMappings: [],
    ...overrides,
  } as TConnectorWithMappings;
}

const oneFeedbackRecord = [
  {
    field_id: "el-1",
    field_type: "rating" as const,
    source_type: "formbricks",
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

describe("handleConnectorPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns early when no connectors for survey", async () => {
    vi.mocked(getConnectorsBySurveyId).mockResolvedValue([]);

    await handleConnectorPipeline(mockResponse, mockSurvey, "env-1");

    expect(transformResponseToFeedbackRecords).not.toHaveBeenCalled();
    expect(mockCreateFeedbackRecordsBatch).not.toHaveBeenCalled();
    expect(updateConnector).not.toHaveBeenCalled();
  });

  test("continues when transform returns no feedback records", async () => {
    const connector = createConnector();
    vi.mocked(getConnectorsBySurveyId).mockResolvedValue([connector]);
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue([]);

    await handleConnectorPipeline(mockResponse, mockSurvey, "env-1");

    expect(transformResponseToFeedbackRecords).toHaveBeenCalledWith(
      mockResponse,
      mockSurvey,
      connector.formbricksMappings,
      "env-1"
    );
    expect(mockCreateFeedbackRecordsBatch).not.toHaveBeenCalled();
    expect(updateConnector).not.toHaveBeenCalled();
  });

  test("updates connector to error when Hub returns no-config (HUB_API_KEY not set)", async () => {
    vi.mocked(getConnectorsBySurveyId).mockResolvedValue([createConnector()]);
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue(oneFeedbackRecord as any);
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: oneFeedbackRecord.map(() => ({ data: null, error: noConfigError })),
    });

    await handleConnectorPipeline(mockResponse, mockSurvey, "env-1");

    expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledWith(oneFeedbackRecord);
    expect(updateConnector).toHaveBeenCalledWith("conn-1", "env-1", {
      status: "error",
      errorMessage: expect.stringContaining("HUB_API_KEY"),
    });
  });

  test("sends records to Hub and updates connector to active on full success", async () => {
    vi.mocked(getConnectorsBySurveyId).mockResolvedValue([createConnector()]);
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue(oneFeedbackRecord as any);
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: [{ data: { id: "hub-1", ...oneFeedbackRecord[0] }, error: null }],
    });

    await handleConnectorPipeline(mockResponse, mockSurvey, "env-1");

    expect(mockCreateFeedbackRecordsBatch).toHaveBeenCalledWith(oneFeedbackRecord);
    expect(updateConnector).toHaveBeenCalledWith("conn-1", "env-1", {
      status: "active",
      errorMessage: null,
      lastSyncAt: expect.any(Date),
    });
  });

  test("updates connector to error when all Hub creates fail", async () => {
    vi.mocked(getConnectorsBySurveyId).mockResolvedValue([createConnector()]);
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue(oneFeedbackRecord as any);
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: [
        { data: null, error: { status: 500, message: "Hub unavailable", detail: "Hub unavailable" } },
      ],
    });

    await handleConnectorPipeline(mockResponse, mockSurvey, "env-1");

    expect(updateConnector).toHaveBeenCalledWith("conn-1", "env-1", {
      status: "error",
      errorMessage: expect.stringContaining("Failed to send FeedbackRecords"),
    });
  });

  test("updates connector to active with partial message when some creates fail", async () => {
    const twoRecords = [...oneFeedbackRecord, { ...oneFeedbackRecord[0], field_id: "el-2", value_number: 3 }];
    const baseMapping = {
      createdAt: new Date(),
      connectorId: "conn-1",
      environmentId: "env-1",
      surveyId: "survey-1",
      hubFieldType: "rating" as const,
      customFieldLabel: null as string | null,
    };
    vi.mocked(getConnectorsBySurveyId).mockResolvedValue([
      createConnector({
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

    await handleConnectorPipeline(mockResponse, mockSurvey, "env-1");

    expect(updateConnector).toHaveBeenCalledWith("conn-1", "env-1", {
      status: "active",
      errorMessage: "Partial failure: 1/2 records sent",
      lastSyncAt: expect.any(Date),
    });
  });

  test("updates connector to error when transform throws", async () => {
    vi.mocked(getConnectorsBySurveyId).mockResolvedValue([createConnector()]);
    vi.mocked(transformResponseToFeedbackRecords).mockImplementation(() => {
      throw new Error("Transform failed");
    });

    await handleConnectorPipeline(mockResponse, mockSurvey, "env-1");

    expect(updateConnector).toHaveBeenCalledWith("conn-1", "env-1", {
      status: "error",
      errorMessage: "Transform failed",
    });
  });
});
