import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    feedbackSourceFormbricksMapping: { findMany: vi.fn() },
    survey: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/survey/utils", () => ({
  getElementsFromBlocks: vi.fn(),
}));

// Keep i18n helpers as thin identity shims so the test exercises option-labels logic,
// not the i18n machinery.
vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: (value: Record<string, string> | undefined, lang: string) => value?.[lang] ?? "",
}));

vi.mock("@formbricks/types/surveys/validation", () => ({
  getTextContent: (value: string) => value,
}));

import { prisma } from "@formbricks/database";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import {
  VALUE_ID_DIMENSION,
  __clearOptionLabelMapCache,
  getOptionLabelMap,
  mapValueIdRowsToLabels,
} from "./option-labels";

const mappingFindMany = vi.mocked(prisma.feedbackSourceFormbricksMapping.findMany);
const surveyFindMany = vi.mocked(prisma.survey.findMany);
const mockedGetElements = vi.mocked(getElementsFromBlocks);

beforeEach(() => {
  vi.clearAllMocks();
  __clearOptionLabelMapCache();
});

describe("getOptionLabelMap", () => {
  test("returns an empty map when the directory has no surveys", async () => {
    mappingFindMany.mockResolvedValue([]);

    const map = await getOptionLabelMap("dir-1", "ws-1");

    expect(map.size).toBe(0);
    expect(surveyFindMany).not.toHaveBeenCalled();
  });

  test("resolves choice and matrix-column ids to their default-language labels", async () => {
    mappingFindMany.mockResolvedValue([{ surveyId: "s1" }, { surveyId: "s1" }] as never);
    surveyFindMany.mockResolvedValue([{ blocks: [] }] as never);
    mockedGetElements.mockReturnValue([
      {
        choices: [
          { id: "c_male", label: { default: "Male", de: "Männlich" } },
          { id: "c_female", label: { default: "Female" } },
          { id: "c_picture" }, // picture choice, no label → skipped
        ],
      },
      {
        columns: [{ id: "col_yes", label: { default: "Yes" } }],
      },
    ] as never);

    const map = await getOptionLabelMap("dir-1", "ws-1");

    expect(map.get("c_male")).toBe("Male");
    expect(map.get("c_female")).toBe("Female");
    expect(map.get("col_yes")).toBe("Yes");
    expect(map.has("c_picture")).toBe(false);
    // Deduped surveyIds → single survey lookup.
    expect(surveyFindMany).toHaveBeenCalledTimes(1);
  });

  test("caches the result so repeated calls within the TTL do not re-query", async () => {
    mappingFindMany.mockResolvedValue([{ surveyId: "s1" }] as never);
    surveyFindMany.mockResolvedValue([{ blocks: [] }] as never);
    mockedGetElements.mockReturnValue([{ choices: [{ id: "c1", label: { default: "One" } }] }] as never);

    const first = await getOptionLabelMap("dir-1", "ws-1");
    const second = await getOptionLabelMap("dir-1", "ws-1");

    expect(second.get("c1")).toBe("One");
    expect(first).toBe(second); // same cached promise result
    expect(mappingFindMany).toHaveBeenCalledTimes(1);
  });

  test("evicts the cache when the lookup rejects so the next call retries", async () => {
    mappingFindMany.mockRejectedValueOnce(new Error("db down"));

    await expect(getOptionLabelMap("dir-1", "ws-1")).rejects.toThrow("db down");

    // Next call must hit the DB again (not a cached rejection).
    mappingFindMany.mockResolvedValue([]);
    const map = await getOptionLabelMap("dir-1", "ws-1");
    expect(map.size).toBe(0);
    expect(mappingFindMany).toHaveBeenCalledTimes(2);
  });
});

describe("mapValueIdRowsToLabels", () => {
  const query: TChartQuery = { measures: ["FeedbackRecords.count"], dimensions: [VALUE_ID_DIMENSION] };

  test("returns rows unchanged when the query does not group by valueId", async () => {
    const rows = [{ [VALUE_ID_DIMENSION]: "c1", "FeedbackRecords.count": 3 }];
    const result = await mapValueIdRowsToLabels(
      rows,
      { measures: ["FeedbackRecords.count"], dimensions: ["FeedbackRecords.sourceName"] },
      "dir-1",
      "ws-1"
    );
    expect(result).toBe(rows);
    expect(mappingFindMany).not.toHaveBeenCalled();
  });

  test("returns rows unchanged when there are no rows", async () => {
    const rows: Record<string, unknown>[] = [];
    const result = await mapValueIdRowsToLabels(rows, query, "dir-1", "ws-1");
    expect(result).toBe(rows);
    expect(mappingFindMany).not.toHaveBeenCalled();
  });

  test("rewrites valueId cells to labels and leaves unresolvable ids as-is", async () => {
    mappingFindMany.mockResolvedValue([{ surveyId: "s1" }] as never);
    surveyFindMany.mockResolvedValue([{ blocks: [] }] as never);
    mockedGetElements.mockReturnValue([
      { choices: [{ id: "c_male", label: { default: "Male" } }] },
    ] as never);

    const rows = [
      { [VALUE_ID_DIMENSION]: "c_male", "FeedbackRecords.count": 6 },
      { [VALUE_ID_DIMENSION]: "c_deleted", "FeedbackRecords.count": 1 },
    ];

    const result = await mapValueIdRowsToLabels(rows, query, "dir-1", "ws-1");

    expect(result[0][VALUE_ID_DIMENSION]).toBe("Male");
    expect(result[1][VALUE_ID_DIMENSION]).toBe("c_deleted"); // no label → raw id kept
  });

  test("returns rows unchanged when no labels resolve", async () => {
    mappingFindMany.mockResolvedValue([]);
    const rows = [{ [VALUE_ID_DIMENSION]: "c1", "FeedbackRecords.count": 2 }];
    const result = await mapValueIdRowsToLabels(rows, query, "dir-1", "ws-1");
    expect(result).toBe(rows);
  });
});
