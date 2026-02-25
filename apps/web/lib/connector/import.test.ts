import { beforeEach, describe, expect, test, vi } from "vitest";
import { TConnectorWithMappings } from "@formbricks/types/connector";
import { InvalidInputError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { importHistoricalResponses } from "./import";

vi.mock("../response/service", () => ({
  getResponses: vi.fn(),
}));

vi.mock("./hub-client", () => ({
  createFeedbackRecordsBatch: vi.fn(),
}));

vi.mock("./transform", () => ({
  transformResponseToFeedbackRecords: vi.fn(),
}));

const { getResponses } = vi.mocked(await import("../response/service"));
const { createFeedbackRecordsBatch } = vi.mocked(await import("./hub-client"));
const { transformResponseToFeedbackRecords } = vi.mocked(await import("./transform"));

const ENV_ID = "clxxxxxxxxxxxxxxxx001";
const CONNECTOR_ID = "clxxxxxxxxxxxxxxxx002";
const SURVEY_ID = "clxxxxxxxxxxxxxxxx003";
const NOW = new Date("2026-02-24T10:00:00.000Z");

const mockConnector: TConnectorWithMappings = {
  id: CONNECTOR_ID,
  createdAt: NOW,
  updatedAt: NOW,
  name: "Test Connector",
  type: "formbricks",
  status: "active",
  environmentId: ENV_ID,
  lastSyncAt: null,
  createdBy: null,
  creatorName: null,
  formbricksMappings: [
    {
      id: "mapping-1",
      createdAt: NOW,
      connectorId: CONNECTOR_ID,
      environmentId: ENV_ID,
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

  test("throws InvalidInputError for non-formbricks connector", async () => {
    const csvConnector = { ...mockConnector, type: "csv" as const };

    await expect(importHistoricalResponses(csvConnector, mockSurvey)).rejects.toThrow(InvalidInputError);
    expect(getResponses).not.toHaveBeenCalled();
  });

  test("returns zeros when there are no responses", async () => {
    getResponses.mockResolvedValue([]);

    const result = await importHistoricalResponses(mockConnector, mockSurvey);

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

    createFeedbackRecordsBatch.mockResolvedValue({
      results: [
        { data: { id: "fb1" }, error: null },
        { data: { id: "fb2" }, error: null },
      ],
    } as never);

    const result = await importHistoricalResponses(mockConnector, mockSurvey);

    expect(result.successes).toBe(2);
    expect(result.failures).toBe(0);
    expect(result.skipped).toBe(1);
  });

  test("counts failures from Hub API errors", async () => {
    const mockResponses = [{ id: "r1" }];
    getResponses.mockResolvedValueOnce(mockResponses as never);
    getResponses.mockResolvedValueOnce([]);

    transformResponseToFeedbackRecords.mockReturnValue([{ field: "record" }] as never);

    createFeedbackRecordsBatch.mockResolvedValue({
      results: [{ data: null, error: { status: 400, message: "Bad request" } }],
    } as never);

    const result = await importHistoricalResponses(mockConnector, mockSurvey);

    expect(result.successes).toBe(0);
    expect(result.failures).toBe(1);
  });

  test("paginates through responses in batches", async () => {
    const batch1 = Array.from({ length: 50 }, (_, i) => ({ id: `r${i}` }));
    const batch2 = [{ id: "r50" }];

    getResponses.mockResolvedValueOnce(batch1 as never);
    getResponses.mockResolvedValueOnce(batch2 as never);
    getResponses.mockResolvedValueOnce([]);

    transformResponseToFeedbackRecords.mockReturnValue([{ field: "record" }] as never);
    createFeedbackRecordsBatch.mockResolvedValue({
      results: [{ data: { id: "fb" }, error: null }],
    } as never);

    await importHistoricalResponses(mockConnector, mockSurvey);

    expect(getResponses).toHaveBeenCalledWith(SURVEY_ID, 50, 0);
    expect(getResponses).toHaveBeenCalledWith(SURVEY_ID, 50, 50);
  });

  test("does not call Hub API when all responses are skipped", async () => {
    const mockResponses = [{ id: "r1" }, { id: "r2" }];
    getResponses.mockResolvedValueOnce(mockResponses as never);
    getResponses.mockResolvedValueOnce([]);

    transformResponseToFeedbackRecords.mockReturnValue([]);

    const result = await importHistoricalResponses(mockConnector, mockSurvey);

    expect(createFeedbackRecordsBatch).not.toHaveBeenCalled();
    expect(result).toEqual({ successes: 0, failures: 0, skipped: 2 });
  });
});
