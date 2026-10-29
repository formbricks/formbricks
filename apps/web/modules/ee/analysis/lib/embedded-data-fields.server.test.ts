import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getEmbeddedFieldMemberId } from "./embedded-data-fields";
import { getEmbeddedChartFields } from "./embedded-data-fields.server";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    feedbackSourceFormbricksMapping: { findMany: vi.fn() },
    survey: { findMany: vi.fn() },
  },
}));

const link = (name: string, source: string, dataType: string, key: string | null = null) => ({
  storageKey: name,
  embeddedData: { id: `id-${name}`, key, name, source, dataType, defaultValue: null, locked: false },
});

describe("getEmbeddedChartFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("reads only the surveys mapped into the dataset from this workspace", async () => {
    vi.mocked(prisma.feedbackSourceFormbricksMapping.findMany).mockResolvedValue([
      { surveyId: "survey-a" },
      { surveyId: "survey-b" },
    ] as never);
    vi.mocked(prisma.survey.findMany).mockResolvedValue([] as never);

    await getEmbeddedChartFields("ws-1", "dir-1");

    expect(prisma.feedbackSourceFormbricksMapping.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws-1", feedbackSource: { workspaceId: "ws-1", feedbackDirectoryId: "dir-1" } },
      })
    );
    expect(prisma.survey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["survey-a", "survey-b"] }, workspaceId: "ws-1" } })
    );
  });

  test("lists ingested and computed fields, shared library ones included, and never reserved ones", async () => {
    vi.mocked(prisma.feedbackSourceFormbricksMapping.findMany).mockResolvedValue([
      { surveyId: "survey-a" },
    ] as never);
    vi.mocked(prisma.survey.findMany).mockResolvedValue([
      {
        name: "Checkout",
        embeddedDataLinks: [
          link("brand", "ingested", "string", "brand"),
          link("score_bucket", "computed", "number"),
          link("url", "reserved", "string"),
        ],
      },
    ] as never);

    const fields = await getEmbeddedChartFields("ws-2", "dir-2");

    expect(fields).toEqual([
      { id: getEmbeddedFieldMemberId("brand"), name: "brand", type: "string", surveyNames: ["Checkout"] },
      {
        id: getEmbeddedFieldMemberId("score_bucket"),
        name: "score_bucket",
        type: "number",
        surveyNames: ["Checkout"],
      },
    ]);
  });

  test("skips the survey lookup for a dataset no survey feeds", async () => {
    vi.mocked(prisma.feedbackSourceFormbricksMapping.findMany).mockResolvedValue([] as never);

    expect(await getEmbeddedChartFields("ws-3", "dir-3")).toEqual([]);
    expect(prisma.survey.findMany).not.toHaveBeenCalled();
  });
});
