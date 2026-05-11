import { beforeEach, describe, expect, test, vi } from "vitest";
import { TConnectorWithMappings } from "@formbricks/types/connector";
import { InvalidInputError } from "@formbricks/types/errors";
import { importCsvData } from "./csv-import";

vi.mock("@/modules/hub", () => ({
  createFeedbackRecordsBatch: vi.fn(),
}));

vi.mock("./csv-transform", () => ({
  transformCsvRowsToFeedbackRecords: vi.fn(),
}));

const { createFeedbackRecordsBatch } = vi.mocked(await import("@/modules/hub"));
const { transformCsvRowsToFeedbackRecords } = vi.mocked(await import("./csv-transform"));

const NOW = new Date("2026-02-25T10:00:00.000Z");

const makeConnector = (overrides?: Partial<TConnectorWithMappings>): TConnectorWithMappings => ({
  id: "conn-1",
  createdAt: NOW,
  updatedAt: NOW,
  name: "CSV Import",
  type: "csv",
  status: "active",
  workspaceId: "env-1",
  feedbackDirectoryId: "tenant-test",
  lastSyncAt: null,
  createdBy: null,
  creatorName: null,
  formbricksMappings: [],
  fieldMappings: [
    {
      id: "fm-1",
      createdAt: NOW,
      connectorId: "conn-1",
      workspaceId: "env-1",
      sourceFieldId: "response_id",
      targetFieldId: "submission_id",
      staticValue: null,
    },
    {
      id: "fm-2",
      createdAt: NOW,
      connectorId: "conn-1",
      workspaceId: "env-1",
      sourceFieldId: "question_id",
      targetFieldId: "field_id",
      staticValue: null,
    },
    {
      id: "fm-3",
      createdAt: NOW,
      connectorId: "conn-1",
      workspaceId: "env-1",
      sourceFieldId: "question",
      targetFieldId: "field_label",
      staticValue: null,
    },
    {
      id: "fm-4",
      createdAt: NOW,
      connectorId: "conn-1",
      workspaceId: "env-1",
      sourceFieldId: "",
      targetFieldId: "field_type",
      staticValue: "text",
    },
    {
      id: "fm-5",
      createdAt: NOW,
      connectorId: "conn-1",
      workspaceId: "env-1",
      sourceFieldId: "feedback",
      targetFieldId: "response_value",
      staticValue: null,
    },
    {
      id: "fm-6",
      createdAt: NOW,
      connectorId: "conn-1",
      workspaceId: "env-1",
      sourceFieldId: "",
      targetFieldId: "source_type",
      staticValue: "csv",
    },
  ],
  ...overrides,
});

describe("importCsvData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws InvalidInputError for non-csv connector", async () => {
    const connector = makeConnector({ type: "formbricks_survey" });
    await expect(importCsvData(connector, [])).rejects.toThrow(InvalidInputError);
  });

  test("throws InvalidInputError when no field mappings configured", async () => {
    const connector = makeConnector({ fieldMappings: [] });
    await expect(importCsvData(connector, [{ feedback: "test" }])).rejects.toThrow(InvalidInputError);
  });

  test("throws InvalidInputError when submission_id is not mapped", async () => {
    const connector = makeConnector({
      fieldMappings: makeConnector().fieldMappings.filter(
        (mapping) => mapping.targetFieldId !== "submission_id"
      ),
    });

    await expect(importCsvData(connector, [{ feedback: "test" }])).rejects.toThrow(InvalidInputError);
    expect(transformCsvRowsToFeedbackRecords).not.toHaveBeenCalled();
  });

  test("returns zeros when all rows are skipped", async () => {
    transformCsvRowsToFeedbackRecords.mockReturnValue({ records: [], skipped: 3 });

    const result = await importCsvData(makeConnector(), [{ a: "1" }, { a: "2" }, { a: "3" }]);

    expect(result).toEqual({ successes: 0, failures: 0, skipped: 3 });
    expect(createFeedbackRecordsBatch).not.toHaveBeenCalled();
  });

  test("sends transformed records to Hub and counts results", async () => {
    transformCsvRowsToFeedbackRecords.mockReturnValue({
      records: [
        {
          source_type: "csv",
          tenant_id: "tenant-test",
          submission_id: "resp-1",
          field_id: "q1",
          field_type: "text" as const,
          value_text: "Good",
        },
        {
          source_type: "csv",
          tenant_id: "tenant-test",
          submission_id: "resp-2",
          field_id: "q2",
          field_type: "text" as const,
          value_text: "Bad",
        },
      ],
      skipped: 1,
    });

    createFeedbackRecordsBatch.mockResolvedValue({
      results: [
        { data: { id: "fb1" }, error: null },
        { data: null, error: { status: 400, message: "Bad request", detail: null } },
      ],
    } as never);

    const result = await importCsvData(makeConnector(), [{}, {}, {}]);

    expect(result).toEqual({ successes: 1, failures: 1, skipped: 1 });
  });

  test("processes records in batches of 50", async () => {
    const records = Array.from({ length: 120 }, (_, i) => ({
      source_type: "csv",
      tenant_id: "tenant-test",
      submission_id: `resp-${i}`,
      field_id: `q${i}`,
      field_type: "text" as const,
      value_text: `row ${i}`,
    }));

    transformCsvRowsToFeedbackRecords.mockReturnValue({ records, skipped: 0 });
    createFeedbackRecordsBatch.mockResolvedValue({
      results: [{ data: { id: "fb" }, error: null }],
    } as never);

    await importCsvData(
      makeConnector(),
      Array.from({ length: 120 }, () => ({}))
    );

    expect(createFeedbackRecordsBatch).toHaveBeenCalledTimes(3);
    expect(createFeedbackRecordsBatch.mock.calls[0][0]).toHaveLength(50);
    expect(createFeedbackRecordsBatch.mock.calls[1][0]).toHaveLength(50);
    expect(createFeedbackRecordsBatch.mock.calls[2][0]).toHaveLength(20);
  });
});
