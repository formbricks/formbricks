import { beforeEach, describe, expect, test, vi } from "vitest";
import { TConnectorWithMappings } from "@formbricks/types/connector";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

vi.mock("@formbricks/hub", () => {
  const create = vi.fn();
  class APIError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "APIError";
      this.status = status;
    }
  }
  const Mock = vi.fn(() => ({ feedbackRecords: { create } }));
  (Mock as unknown as { APIError: typeof APIError }).APIError = APIError;
  (Mock as unknown as { __create: typeof create }).__create = create;
  return { default: Mock };
});

vi.mock("@/lib/env", () => ({
  env: {
    HUB_API_KEY: "test-key",
    HUB_API_URL: undefined,
  },
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
const hubModule = await import("@formbricks/hub");
const mockFeedbackRecordsCreate = (hubModule.default as unknown as { __create: ReturnType<typeof vi.fn> })
  .__create;

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

const env = await import("@/lib/env").then((m) => m.env);

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

describe("handleConnectorPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(env).HUB_API_KEY = "test-key";
    vi.mocked(env).HUB_API_URL = undefined;
  });

  test("returns early when no connectors for survey", async () => {
    vi.mocked(getConnectorsBySurveyId).mockResolvedValue([]);

    await handleConnectorPipeline(mockResponse, mockSurvey, "env-1");

    expect(transformResponseToFeedbackRecords).not.toHaveBeenCalled();
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
    expect(mockFeedbackRecordsCreate).not.toHaveBeenCalled();
    expect(updateConnector).not.toHaveBeenCalled();
  });

  test("updates connector to error when HUB_API_KEY is not set", async () => {
    vi.mocked(env).HUB_API_KEY = undefined as any;
    vi.mocked(getConnectorsBySurveyId).mockResolvedValue([createConnector()]);
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue(oneFeedbackRecord as any);

    await handleConnectorPipeline(mockResponse, mockSurvey, "env-1");

    expect(mockFeedbackRecordsCreate).not.toHaveBeenCalled();
    expect(updateConnector).toHaveBeenCalledWith("conn-1", "env-1", {
      status: "error",
      errorMessage: expect.stringContaining("HUB_API_KEY"),
    });
  });

  test("sends records to Hub and updates connector to active on full success", async () => {
    vi.mocked(getConnectorsBySurveyId).mockResolvedValue([createConnector()]);
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue(oneFeedbackRecord as any);
    mockFeedbackRecordsCreate.mockResolvedValue({ id: "hub-1", ...oneFeedbackRecord[0] });

    await handleConnectorPipeline(mockResponse, mockSurvey, "env-1");

    expect(mockFeedbackRecordsCreate).toHaveBeenCalledTimes(1);
    expect(mockFeedbackRecordsCreate).toHaveBeenCalledWith(oneFeedbackRecord[0]);
    expect(updateConnector).toHaveBeenCalledWith("conn-1", "env-1", {
      status: "active",
      errorMessage: null,
      lastSyncAt: expect.any(Date),
    });
  });

  test("updates connector to error when all Hub creates fail", async () => {
    vi.mocked(getConnectorsBySurveyId).mockResolvedValue([createConnector()]);
    vi.mocked(transformResponseToFeedbackRecords).mockReturnValue(oneFeedbackRecord as any);
    mockFeedbackRecordsCreate.mockRejectedValue(new Error("Hub unavailable"));

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
    mockFeedbackRecordsCreate
      .mockResolvedValueOnce({ id: "hub-1" })
      .mockRejectedValueOnce(new Error("Rate limited"));

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
