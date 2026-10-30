import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getSurvey } from "../survey/service";
import {
  buildAnalysisSelect,
  buildAnalysisWhere,
  buildLowQualityScopeWhere,
  openAnalysisExport,
} from "./index";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: { response: { count: vi.fn(), findMany: vi.fn() } },
}));
vi.mock("@/lib/survey/service", () => ({ getSurvey: vi.fn() }));
vi.mock("../survey/service", () => ({ getSurvey: vi.fn() }));
vi.mock("@/modules/storage/utils", () => ({
  resolveStorageUrlsInObject: (value: unknown) => value,
  getSurveyFileUploadElementIds: () => new Set<string>(),
}));

const survey = {
  id: "clsurvey0000000000000000",
  blocks: [
    {
      id: "b1",
      name: "b",
      elements: [
        {
          id: "e1",
          type: "multipleChoiceSingle",
          code: "q1",
          required: false,
          headline: { default: "Colour?" },
          choices: [
            { id: "c1", code: "1", label: { default: "Red" } },
            { id: "c2", code: "2", label: { default: "Blue" } },
          ],
        },
      ],
    },
  ],
  languages: [],
  embeddedFields: [],
  variables: [],
  hiddenFields: { enabled: false, fieldIds: [] },
};

const row = (id: string, minute: number, data: Record<string, unknown>, outcome: string | null = null) => ({
  id,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, minute)),
  finished: true,
  language: "en",
  outcome,
  data,
});

describe("buildAnalysisWhere", () => {
  test("leaves Low quality out by default and counts what it left out", () => {
    const where = buildAnalysisWhere(survey as never, undefined);
    expect(where.included).toEqual({
      AND: [expect.objectContaining({ surveyId: survey.id }), { outcome: null }],
    });
    expect(where.lowQualityLeftOut).toEqual({
      AND: [expect.objectContaining({ surveyId: survey.id }), { outcome: "lowQuality" }],
    });
  });

  test("includeLowQuality writes them too and leaves nothing out", () => {
    const where = buildAnalysisWhere(survey as never, undefined, true);
    expect(JSON.stringify(where.included)).not.toContain('"outcome":null');
    expect(where.lowQualityLeftOut).toBeNull();
  });

  test("the Low quality in scope is counted whether or not they are included", () => {
    expect(buildLowQualityScopeWhere(survey as never, undefined)).toEqual({
      AND: [expect.objectContaining({ surveyId: survey.id }), { outcome: "lowQuality" }],
    });
  });

  test("a filter that selects Low quality wins: nothing is excluded", () => {
    const where = buildAnalysisWhere(survey as never, { outcome: "lowQuality" });
    expect(JSON.stringify(where.included)).toContain("lowQuality");
    expect(JSON.stringify(where.included)).not.toContain('"outcome":null');
    expect(where.lowQualityLeftOut).toBeNull();
  });
});

describe("buildAnalysisSelect", () => {
  test("stays lean: no tags, contact, quotas or metadata unless selected", () => {
    expect(Object.keys(buildAnalysisSelect({}, false)).sort()).toEqual(
      ["createdAt", "data", "finished", "id", "language", "outcome"].sort()
    );
  });

  test("adds only what the selected fields read", () => {
    const keys = Object.keys(buildAnalysisSelect({ tags: true, contact: true, quotas: true }, true));
    expect(keys).toEqual(expect.arrayContaining(["tags", "contact", "quotaLinks"]));
    expect(Object.keys(buildAnalysisSelect({ quotas: true }, false))).not.toContain("quotaLinks");
    expect(Object.keys(buildAnalysisSelect({ contactAttributes: true }, false))).toContain(
      "contactAttributes"
    );
  });
});

describe("openAnalysisExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSurvey).mockResolvedValue(survey as never);
  });

  test("reads by cursor, one query per batch, and reports unmapped values from the same pass", async () => {
    vi.mocked(prisma.response.count).mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    vi.mocked(prisma.response.findMany)
      .mockResolvedValueOnce([row("r3", 3, { e1: "Red" }), row("r2", 2, { e1: "Crimson" })] as never)
      .mockResolvedValueOnce([row("r1", 1, { e1: "Blue" })] as never);

    const result = await openAnalysisExport({ surveyId: survey.id, batchSize: 2 });
    expect(result.counts).toEqual({ included: 3, lowQualityLeftOut: 2 });

    const rows = [];
    for await (const batch of result.rows()) rows.push(...batch);

    expect(prisma.response.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.response.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 2,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ createdAt: { lte: new Date(Date.UTC(2026, 0, 1, 0, 2)) } }),
          ]),
        }),
      })
    );
    const q1 = result.columns.findIndex((c) => c.name === "q1");
    expect(rows.map((r) => r.codes?.[q1])).toEqual(["1", "UNMAPPED:Crimson", "2"]);

    const { unmapped, rowCount } = result.summary();
    expect(rowCount).toBe(3);
    expect(unmapped).toEqual([
      expect.objectContaining({
        column: "q1",
        value: "Crimson",
        responseIds: ["r2"],
        closest: expect.objectContaining({ code: "1" }),
      }),
    ]);
  });

  test("does not count Low quality when the filter selects it", async () => {
    vi.mocked(prisma.response.count).mockResolvedValueOnce(4);
    vi.mocked(prisma.response.findMany).mockResolvedValueOnce([row("r1", 1, {}, "lowQuality")] as never);
    const result = await openAnalysisExport({ surveyId: survey.id, filter: { outcome: "lowQuality" } });
    expect(prisma.response.count).toHaveBeenCalledTimes(1);
    expect(result.counts).toEqual({ included: 4, lowQualityLeftOut: 0 });
    const batches = [];
    for await (const batch of result.rows()) batches.push(batch);
    expect(batches[0][0].codes?.[result.columns.findIndex((c) => c.name === "outcome")]).toBe("lowQuality");
  });

  test("an unknown survey is a not-found error", async () => {
    vi.mocked(getSurvey).mockResolvedValueOnce(null);
    await expect(openAnalysisExport({ surveyId: survey.id })).rejects.toThrow("Survey");
  });
});
