import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import {
  applyReconciliationToFeedbackSource,
  reconcileFeedbackSourcesForSurvey,
  reconcileMappingsAgainstSurvey,
} from "./mapping-reconciliation";
import { getFeedbackSourcesBySurveyId } from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    feedbackSourceFormbricksMapping: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("./service", () => ({
  getFeedbackSourcesBySurveyId: vi.fn(),
}));

// Deliberately unmocked: @/lib/survey/utils, @formbricks/types/feedback-source and
// @/lib/utils/validate. The point of these tests is that the real element walk, the real
// element-type -> Hub-field table and the real id validation decide the outcome; stubbing any of
// them would let the fixtures drift from what production sees.

const SOURCE_ID = "clxxxxxxxxxxxxxxxx001";
const WORKSPACE_ID = "clxxxxxxxxxxxxxxxx002";
const SURVEY_ID = "clxxxxxxxxxxxxxxxx003";
const OTHER_SURVEY_ID = "clxxxxxxxxxxxxxxxx004";

const buildBlocks = (elements: { id: string; type: string }[]): TSurveyBlock[] =>
  [{ id: "block-1", name: "Block 1", elements }] as unknown as TSurveyBlock[];

const mapping = (elementId: string, hubFieldType: string, surveyId = SURVEY_ID) =>
  ({ surveyId, elementId, hubFieldType }) as Parameters<typeof reconcileMappingsAgainstSurvey>[0][number];

const mockTx = () => {
  const tx = {
    feedbackSourceFormbricksMapping: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(tx));
  return tx;
};

describe("reconcileMappingsAgainstSurvey", () => {
  test("returns an empty delta when the survey is unchanged", () => {
    const blocks = buildBlocks([
      { id: "el-text", type: "openText" },
      { id: "el-nps", type: "nps" },
    ]);

    expect(
      reconcileMappingsAgainstSurvey(
        [mapping("el-text", "text"), mapping("el-nps", "nps")],
        blocks,
        SURVEY_ID,
        "all"
      )
    ).toEqual({ toCreate: [], toDelete: [], toUpdate: [] });
  });

  test("deletes mappings for elements removed from the survey", () => {
    const blocks = buildBlocks([{ id: "el-text", type: "openText" }]);

    const result = reconcileMappingsAgainstSurvey(
      [mapping("el-text", "text"), mapping("el-gone", "rating")],
      blocks,
      SURVEY_ID,
      "specific"
    );

    expect(result.toDelete).toEqual(["el-gone"]);
    expect(result.toUpdate).toEqual([]);
  });

  test("updates hubFieldType when an element is retyped", () => {
    const blocks = buildBlocks([{ id: "el-q", type: "nps" }]);

    const result = reconcileMappingsAgainstSurvey([mapping("el-q", "text")], blocks, SURVEY_ID, "specific");

    expect(result.toUpdate).toEqual([{ elementId: "el-q", hubFieldType: "nps" }]);
    expect(result.toDelete).toEqual([]);
  });

  // Regression: getHubFieldTypeFromElementType is a bare index access declared as non-nullable, so
  // an unsupported type yields undefined. Treating that as "unchanged" left the row publishing under
  // a stale hubFieldType — for element types the product refuses to map at all (fileUpload holds
  // files, contactInfo/address hold PII).
  test.each([["fileUpload"], ["contactInfo"], ["address"], ["consent"], ["cta"], ["cal"]])(
    "deletes the mapping when an element is retyped to the unmappable type %s",
    (elementType) => {
      // A second, still-valid mapping keeps this out of the "would empty the survey" guard below,
      // so the assertion is about the retype and nothing else.
      const blocks = buildBlocks([
        { id: "el-q", type: elementType },
        { id: "el-keep", type: "openText" },
      ]);

      const result = reconcileMappingsAgainstSurvey(
        [mapping("el-q", "text"), mapping("el-keep", "text")],
        blocks,
        SURVEY_ID,
        "specific"
      );

      expect(result.toDelete).toEqual(["el-q"]);
      expect(result.toUpdate).toEqual([]);
      expect(result.toCreate).toEqual([]);
    }
  );

  // The elementScope gate. A newly added question is indistinguishable from one the operator
  // deliberately excluded, so the answer comes from what they selected when the source was saved.
  describe("elementScope gate on newly added questions", () => {
    const blocks = buildBlocks([
      { id: "el-text", type: "openText" },
      { id: "el-new", type: "rating" },
    ]);

    test("maps a newly added supported element when the source tracks everything", () => {
      const result = reconcileMappingsAgainstSurvey([mapping("el-text", "text")], blocks, SURVEY_ID, "all");

      expect(result.toCreate).toEqual([{ elementId: "el-new", hubFieldType: "rating" }]);
      expect(result.toDelete).toEqual([]);
      expect(result.toUpdate).toEqual([]);
    });

    test("leaves it alone when the source tracks a curated subset", () => {
      const result = reconcileMappingsAgainstSurvey(
        [mapping("el-text", "text")],
        blocks,
        SURVEY_ID,
        "specific"
      );

      expect(result).toEqual({ toCreate: [], toDelete: [], toUpdate: [] });
    });

    test("never maps an added element whose type has no Hub field, even when tracking everything", () => {
      const result = reconcileMappingsAgainstSurvey(
        [mapping("el-text", "text")],
        buildBlocks([
          { id: "el-text", type: "openText" },
          { id: "el-upload", type: "fileUpload" },
        ]),
        SURVEY_ID,
        "all"
      );

      expect(result.toCreate).toEqual([]);
    });

    test("does not map a sibling survey's elements when tracking everything", () => {
      const result = reconcileMappingsAgainstSurvey(
        [mapping("el-text", "text"), mapping("el-new", "rating"), mapping("el-x", "nps", OTHER_SURVEY_ID)],
        blocks,
        SURVEY_ID,
        "all"
      );

      expect(result).toEqual({ toCreate: [], toDelete: [], toUpdate: [] });
    });
  });

  // Regression: a feedback source can map several surveys (the action schema takes an array of
  // {surveyId, elementIds}, and transform.ts filters by survey.id when publishing). Diffing the
  // source's full mapping list against one survey's blocks made every sibling survey's row look like
  // a removed element and deleted it.
  test("ignores mappings that belong to another survey of the same source", () => {
    const blocks = buildBlocks([{ id: "el-text", type: "openText" }]);

    const result = reconcileMappingsAgainstSurvey(
      [
        mapping("el-text", "text"),
        mapping("el-other-survey-q", "categorical", OTHER_SURVEY_ID),
        mapping("el-another", "nps", OTHER_SURVEY_ID),
      ],
      blocks,
      SURVEY_ID,
      "specific"
    );

    expect(result).toEqual({ toCreate: [], toDelete: [], toUpdate: [] });
  });

  test("reconciles this survey's rows while leaving a sibling survey's alone", () => {
    const blocks = buildBlocks([{ id: "el-text", type: "openText" }]);

    const result = reconcileMappingsAgainstSurvey(
      [
        mapping("el-text", "text"),
        mapping("el-gone", "rating"),
        mapping("el-sibling-gone", "nps", OTHER_SURVEY_ID),
      ],
      blocks,
      SURVEY_ID,
      "specific"
    );

    expect(result.toDelete).toEqual(["el-gone"]);
  });

  // A source with zero rows for its survey is unreachable through every other write path (both
  // action schemas require min(1)) and unrecoverable, because getFeedbackSourcesBySurveyId matches on
  // `formbricksMappings: { some: { surveyId } }` — the source would never be found for this survey
  // again, so no later reconcile could heal it.
  test("skips the delete when it would remove every mapping for the survey", () => {
    const blocks = buildBlocks([{ id: "el-unrelated", type: "fileUpload" }]);

    const result = reconcileMappingsAgainstSurvey(
      [mapping("el-text", "text"), mapping("el-nps", "nps")],
      blocks,
      SURVEY_ID,
      "specific"
    );

    expect(result).toEqual({ toCreate: [], toDelete: [], toUpdate: [] });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: SURVEY_ID }),
      "Skipping feedback-source reconciliation: it would remove every mapping for this survey"
    );
  });

  test("still deletes stale mappings while at least one survives", () => {
    const blocks = buildBlocks([{ id: "el-keep", type: "openText" }]);

    const result = reconcileMappingsAgainstSurvey(
      [mapping("el-keep", "text"), mapping("el-gone-a", "nps"), mapping("el-gone-b", "rating")],
      blocks,
      SURVEY_ID,
      "specific"
    );

    expect(result.toDelete).toEqual(["el-gone-a", "el-gone-b"]);
  });

  test("treats an empty survey with no stored mappings as a no-op", () => {
    expect(reconcileMappingsAgainstSurvey([], [], SURVEY_ID, "all")).toEqual({
      toCreate: [],
      toDelete: [],
      toUpdate: [],
    });
  });

  test("returns a fresh delta each call so callers cannot alias a shared object", () => {
    const blocks = buildBlocks([{ id: "el-text", type: "openText" }]);
    const first = reconcileMappingsAgainstSurvey([mapping("el-text", "text")], blocks, SURVEY_ID, "specific");
    first.toDelete.push("mutated");

    const second = reconcileMappingsAgainstSurvey(
      [mapping("el-text", "text")],
      blocks,
      SURVEY_ID,
      "specific"
    );
    expect(second.toDelete).toEqual([]);
  });
});

describe("applyReconciliationToFeedbackSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("does not open a transaction for an empty delta", async () => {
    await applyReconciliationToFeedbackSource(SOURCE_ID, WORKSPACE_ID, SURVEY_ID, {
      toCreate: [],
      toDelete: [],
      toUpdate: [],
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // Regression: without surveyId in the where clause this deleted the matching elementIds across
  // every survey the source maps.
  test("scopes the delete to the reconciled survey", async () => {
    const tx = mockTx();

    await applyReconciliationToFeedbackSource(SOURCE_ID, WORKSPACE_ID, SURVEY_ID, {
      toCreate: [],
      toDelete: ["el-1", "el-2"],
      toUpdate: [],
    });

    expect(tx.feedbackSourceFormbricksMapping.deleteMany).toHaveBeenCalledWith({
      where: {
        feedbackSourceId: SOURCE_ID,
        workspaceId: WORKSPACE_ID,
        surveyId: SURVEY_ID,
        elementId: { in: ["el-1", "el-2"] },
      },
    });
  });

  test("batches updates by hubFieldType and scopes them to the survey", async () => {
    const tx = mockTx();

    await applyReconciliationToFeedbackSource(SOURCE_ID, WORKSPACE_ID, SURVEY_ID, {
      toCreate: [],
      toDelete: [],
      toUpdate: [
        { elementId: "el-a", hubFieldType: "nps" },
        { elementId: "el-b", hubFieldType: "categorical" },
        { elementId: "el-c", hubFieldType: "nps" },
      ],
    });

    // Three changed elements, two distinct target types -> two statements, not three.
    expect(tx.feedbackSourceFormbricksMapping.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.feedbackSourceFormbricksMapping.updateMany).toHaveBeenCalledWith({
      where: {
        feedbackSourceId: SOURCE_ID,
        workspaceId: WORKSPACE_ID,
        surveyId: SURVEY_ID,
        elementId: { in: ["el-a", "el-c"] },
      },
      data: { hubFieldType: "nps" },
    });
    expect(tx.feedbackSourceFormbricksMapping.updateMany).toHaveBeenCalledWith({
      where: {
        feedbackSourceId: SOURCE_ID,
        workspaceId: WORKSPACE_ID,
        surveyId: SURVEY_ID,
        elementId: { in: ["el-b"] },
      },
      data: { hubFieldType: "categorical" },
    });
  });

  test("creates new mappings for the reconciled survey, tolerating a concurrent writer", async () => {
    const tx = mockTx();

    await applyReconciliationToFeedbackSource(SOURCE_ID, WORKSPACE_ID, SURVEY_ID, {
      toCreate: [{ elementId: "el-new", hubFieldType: "rating" }],
      toDelete: [],
      toUpdate: [],
    });

    expect(tx.feedbackSourceFormbricksMapping.createMany).toHaveBeenCalledWith({
      data: [
        {
          feedbackSourceId: SOURCE_ID,
          workspaceId: WORKSPACE_ID,
          surveyId: SURVEY_ID,
          elementId: "el-new",
          hubFieldType: "rating",
        },
      ],
      skipDuplicates: true,
    });
  });

  test("applies delete, update and create in a single transaction", async () => {
    const tx = mockTx();

    await applyReconciliationToFeedbackSource(SOURCE_ID, WORKSPACE_ID, SURVEY_ID, {
      toCreate: [{ elementId: "el-new", hubFieldType: "rating" }],
      toDelete: ["el-gone"],
      toUpdate: [{ elementId: "el-retyped", hubFieldType: "nps" }],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.feedbackSourceFormbricksMapping.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.feedbackSourceFormbricksMapping.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.feedbackSourceFormbricksMapping.createMany).toHaveBeenCalledTimes(1);
  });

  test("rejects a malformed id without writing, and still does not throw", async () => {
    const tx = mockTx();

    await expect(
      applyReconciliationToFeedbackSource(SOURCE_ID, WORKSPACE_ID, "not-a-cuid", {
        toCreate: [],
        toDelete: ["el-1"],
        toUpdate: [],
      })
    ).resolves.toBeUndefined();

    expect(tx.feedbackSourceFormbricksMapping.deleteMany).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  test("logs and swallows a database failure so the survey write is never blocked", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("DB failure"));

    await expect(
      applyReconciliationToFeedbackSource(SOURCE_ID, WORKSPACE_ID, SURVEY_ID, {
        toCreate: [],
        toDelete: ["el-1"],
        toUpdate: [],
      })
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ feedbackSourceId: SOURCE_ID, surveyId: SURVEY_ID }),
      "Failed to apply feedback-source reconciliation"
    );
  });
});

describe("reconcileFeedbackSourcesForSurvey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("reconciles each active source against the persisted blocks", async () => {
    const tx = mockTx();
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([
      {
        id: SOURCE_ID,
        workspaceId: WORKSPACE_ID,
        elementScope: "specific",
        formbricksMappings: [
          { surveyId: SURVEY_ID, elementId: "el-kept", hubFieldType: "rating" },
          { surveyId: SURVEY_ID, elementId: "el-gone", hubFieldType: "text" },
          { surveyId: OTHER_SURVEY_ID, elementId: "el-sibling", hubFieldType: "nps" },
        ],
      },
    ] as any);

    await reconcileFeedbackSourcesForSurvey(SURVEY_ID, buildBlocks([{ id: "el-kept", type: "rating" }]));

    expect(getFeedbackSourcesBySurveyId).toHaveBeenCalledWith(SURVEY_ID);
    // The sibling survey's row must survive; only this survey's stale row is removed.
    expect(tx.feedbackSourceFormbricksMapping.deleteMany).toHaveBeenCalledWith({
      where: {
        feedbackSourceId: SOURCE_ID,
        workspaceId: WORKSPACE_ID,
        surveyId: SURVEY_ID,
        elementId: { in: ["el-gone"] },
      },
    });
  });

  test("does nothing when the survey backs no feedback source", async () => {
    vi.mocked(getFeedbackSourcesBySurveyId).mockResolvedValue([]);

    await reconcileFeedbackSourcesForSurvey(SURVEY_ID, buildBlocks([{ id: "el-a", type: "openText" }]));

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("logs and swallows a lookup failure so the survey write is never blocked", async () => {
    vi.mocked(getFeedbackSourcesBySurveyId).mockRejectedValue(new Error("DB down"));

    await expect(
      reconcileFeedbackSourcesForSurvey(SURVEY_ID, buildBlocks([{ id: "el-a", type: "openText" }]))
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: SURVEY_ID }),
      "Failed to reconcile feedback sources after survey update"
    );
  });
});
