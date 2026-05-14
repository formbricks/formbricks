import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TConnectorWithMappings } from "@formbricks/types/connector";
import { InvalidInputError } from "@formbricks/types/errors";
import { CSV_IMPORT_MISSING_COLUMNS_ERROR_CODE } from "@/modules/ee/unify-feedback/sources/types";
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

const matchingCsvRow = {
  response_id: "resp-1",
  question_id: "q1",
  question: "Question?",
  feedback: "Great",
};

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

    await expect(importCsvData(connector, [matchingCsvRow])).rejects.toThrow(
      "This saved CSV mapping is incomplete"
    );
    expect(transformCsvRowsToFeedbackRecords).not.toHaveBeenCalled();
  });

  test("throws InvalidInputError when uploaded CSV is missing a mapped source column", async () => {
    const connector = makeConnector({
      fieldMappings: makeConnector().fieldMappings.map((mapping) =>
        mapping.targetFieldId === "submission_id" ? { ...mapping, sourceFieldId: "source_id" } : mapping
      ),
    });

    await expect(importCsvData(connector, [matchingCsvRow])).rejects.toThrow(
      CSV_IMPORT_MISSING_COLUMNS_ERROR_CODE
    );
    expect(transformCsvRowsToFeedbackRecords).not.toHaveBeenCalled();
  });

  test("returns zeros when all rows are skipped", async () => {
    transformCsvRowsToFeedbackRecords.mockReturnValue({ records: [], skipped: 3 });

    const result = await importCsvData(makeConnector(), [
      matchingCsvRow,
      { ...matchingCsvRow, response_id: "resp-2" },
      { ...matchingCsvRow, response_id: "resp-3" },
    ]);

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

    const result = await importCsvData(makeConnector(), [
      matchingCsvRow,
      { ...matchingCsvRow, response_id: "resp-2" },
      { ...matchingCsvRow, response_id: "resp-3" },
    ]);

    expect(result).toEqual({ successes: 1, failures: 1, skipped: 1 });
  });

  test("treats Hub 409 conflicts as skipped (duplicate submission_id+field_id), not failed", async () => {
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
      skipped: 0,
    });

    createFeedbackRecordsBatch.mockResolvedValue({
      results: [
        { data: null, error: { status: 409, message: "duplicate feedback record", detail: null } },
        { data: null, error: { status: 409, message: "duplicate feedback record", detail: null } },
      ],
    } as never);

    const result = await importCsvData(makeConnector(), [
      matchingCsvRow,
      { ...matchingCsvRow, response_id: "resp-2" },
    ]);

    expect(result).toEqual({ successes: 0, failures: 0, skipped: 2 });
  });

  test("mixed 200/409/500 — successes, skipped, and failures counted separately", async () => {
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
          value_text: "Dupe",
        },
        {
          source_type: "csv",
          tenant_id: "tenant-test",
          submission_id: "resp-3",
          field_id: "q3",
          field_type: "text" as const,
          value_text: "Boom",
        },
      ],
      skipped: 0,
    });

    createFeedbackRecordsBatch.mockResolvedValue({
      results: [
        { data: { id: "fb1" }, error: null },
        { data: null, error: { status: 409, message: "duplicate", detail: null } },
        { data: null, error: { status: 500, message: "internal", detail: null } },
      ],
    } as never);

    const result = await importCsvData(makeConnector(), [
      matchingCsvRow,
      { ...matchingCsvRow, response_id: "resp-2" },
      { ...matchingCsvRow, response_id: "resp-3" },
    ]);

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
      Array.from({ length: 120 }, (_, i) => ({ ...matchingCsvRow, response_id: `resp-${i}` }))
    );

    expect(createFeedbackRecordsBatch).toHaveBeenCalledTimes(3);
    expect(createFeedbackRecordsBatch.mock.calls[0][0]).toHaveLength(50);
    expect(createFeedbackRecordsBatch.mock.calls[1][0]).toHaveLength(50);
    expect(createFeedbackRecordsBatch.mock.calls[2][0]).toHaveLength(20);
  });
});
