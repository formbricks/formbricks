import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  TIntegrationAirtableConfigData,
  TIntegrationAirtableCredential,
} from "@formbricks/types/integration/airtable";

vi.mock("@/lib/integration/service", () => ({
  createOrUpdateIntegration: vi.fn(),
  getIntegrationByType: vi.fn(),
}));

const { writeData } = await import("@/lib/airtable/service");

const key: TIntegrationAirtableCredential = {
  access_token: "token",
  refresh_token: "refresh",
  expiry_date: new Date(Date.now() + 3_600_000).toISOString(),
};

const configData = {
  baseId: "base1",
  tableId: "table1",
  tableName: "Responses",
  surveyId: "survey1",
  surveyName: "Survey",
  elementIds: ["q1"],
  elements: "selectedElements",
  createdAt: new Date(),
} as TIntegrationAirtableConfigData;

/**
 * A stand-in for Airtable's REST API: the table's field names, the fields `writeData` creates, and the
 * records it adds. A created field shows up in the next table listing, as it does on Airtable.
 */
const airtable = {
  fieldNames: [] as string[],
  createdFields: [] as string[],
  records: [] as Record<string, string>[],
};

const json = (body: unknown) => ({ ok: true, json: async () => body, text: async () => "" });

const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  if (url.endsWith("/meta/bases/base1/tables")) {
    return json({
      tables: [
        {
          id: "table1",
          name: "Responses",
          fields: airtable.fieldNames.map((name, i) => ({ id: `f${i}`, name })),
        },
      ],
    });
  }
  if (url.endsWith("/meta/bases/base1/tables/table1/fields") && init?.method === "POST") {
    const { name } = JSON.parse(init.body ?? "{}") as { name: string };
    airtable.createdFields.push(name);
    airtable.fieldNames.push(name);
    return json({ id: `new-${name}`, name });
  }
  if (url.endsWith("/v0/base1/table1") && init?.method === "POST") {
    const { fields } = JSON.parse(init.body ?? "{}") as { fields: Record<string, string> };
    airtable.records.push(fields);
    return json({ id: "rec1", fields });
  }
  throw new Error(`Unexpected Airtable request: ${init?.method ?? "GET"} ${url}`);
});

beforeEach(() => {
  airtable.fieldNames = [];
  airtable.createdFields = [];
  airtable.records = [];
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockClear();
});

describe("writeData", () => {
  // ENG-3682: a two-paragraph headline was labelled "First lineSecond line" before the fix and
  // "First line Second line" after it. Airtable matches fields by name.
  const label = "First line Second line";
  const legacyLabel = "First lineSecond line";

  test("keeps writing to the field an existing table created under the legacy label", async () => {
    airtable.fieldNames = [legacyLabel];

    await writeData(key, configData, ["answer"], [label], [legacyLabel]);

    expect(airtable.createdFields).toEqual([]);
    expect(airtable.records).toEqual([{ [legacyLabel]: "answer" }]);
  });

  test("creates the field under the new label when the table has neither", async () => {
    airtable.fieldNames = [];

    await writeData(key, configData, ["answer"], [label], [legacyLabel]);

    expect(airtable.createdFields).toEqual([label]);
    expect(airtable.records).toEqual([{ [label]: "answer" }]);
  });

  test("writes to the field with the new label when the table has it", async () => {
    airtable.fieldNames = [label, legacyLabel];

    await writeData(key, configData, ["answer"], [label], [legacyLabel]);

    expect(airtable.createdFields).toEqual([]);
    expect(airtable.records).toEqual([{ [label]: "answer" }]);
  });

  test("does not let the legacy fallback take the field another question owns by its own label", async () => {
    // A plain "First lineSecond line" headline owns that field; the two-paragraph one gets its own.
    airtable.fieldNames = [legacyLabel];

    await writeData(key, configData, ["a", "b"], [label, legacyLabel], [legacyLabel, legacyLabel]);

    expect(airtable.createdFields).toEqual([label]);
    expect(airtable.records).toEqual([{ [label]: "a", [legacyLabel]: "b" }]);
  });

  test("uses the labels as they are when no legacy labels are passed", async () => {
    airtable.fieldNames = ["Metadata"];

    await writeData(key, configData, ["a", "b"], ["Metadata", "Created At"]);

    expect(airtable.createdFields).toEqual(["Created At"]);
    expect(airtable.records).toEqual([{ Metadata: "a", "Created At": "b" }]);
  });

  test("rejects legacy labels that do not line up with the labels", async () => {
    await expect(writeData(key, configData, ["a"], ["Q1"], [])).rejects.toThrow("Array length mismatch");
  });
});
