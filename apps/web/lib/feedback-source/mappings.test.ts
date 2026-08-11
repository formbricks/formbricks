import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { resolveFormbricksMappingsInput, reconcileMappingsAgainstSurvey } from "./mappings";

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

// Deliberately unmocked: @/lib/survey/utils — getElementsFromBlocks is a plain flatMap over the
// blocks, so the real one keeps the fixtures honest about the shape it reads.

const { getSurvey } = vi.mocked(await import("@/lib/survey/service"));

const WORKSPACE_ID = "clxxxxxxxxxxxxxxxx001";
const OTHER_WORKSPACE_ID = "clxxxxxxxxxxxxxxxx002";
const SURVEY_ID = "clxxxxxxxxxxxxxxxx003";
const OTHER_SURVEY_ID = "clxxxxxxxxxxxxxxxx004";

const buildSurvey = (id: string, workspaceId: string): TSurvey =>
  ({
    id,
    workspaceId,
    blocks: [
      {
        elements: [
          { id: "el-text", type: "openText" },
          { id: "el-nps", type: "nps" },
        ],
      },
      {
        elements: [
          { id: "el-rating", type: "rating" },
          // No Hub field type exists for file uploads.
          { id: "el-file", type: "fileUpload" },
        ],
      },
    ],
  }) as unknown as TSurvey;

describe("resolveFormbricksMappingsInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("resolves elements across surveys and blocks in the workspace", async () => {
    getSurvey.mockImplementation(async (surveyId: string) => buildSurvey(surveyId, WORKSPACE_ID));

    const result = await resolveFormbricksMappingsInput(
      [
        { surveyId: SURVEY_ID, elementIds: ["el-text", "el-rating"] },
        { surveyId: OTHER_SURVEY_ID, elementIds: ["el-nps"] },
      ],
      WORKSPACE_ID
    );

    expect(result).toEqual({
      type: "formbricks_survey",
      mappings: [
        { surveyId: SURVEY_ID, elementId: "el-text", hubFieldType: "text" },
        { surveyId: SURVEY_ID, elementId: "el-rating", hubFieldType: "rating" },
        { surveyId: OTHER_SURVEY_ID, elementId: "el-nps", hubFieldType: "nps" },
      ],
    });
  });

  // Tenancy guard: the caller is authorized on `workspaceId`, but `surveyId` is caller-supplied and
  // survey ids are not secret (they appear in every /s/<surveyId> link). Not-found rather than
  // unauthorized, so the response cannot confirm that a foreign survey id exists.
  test("rejects a survey from another workspace", async () => {
    getSurvey.mockResolvedValue(buildSurvey(SURVEY_ID, OTHER_WORKSPACE_ID));

    await expect(
      resolveFormbricksMappingsInput([{ surveyId: SURVEY_ID, elementIds: ["el-text"] }], WORKSPACE_ID)
    ).rejects.toThrow(ResourceNotFoundError);
  });

  test("rejects the whole input when only one of several surveys is foreign", async () => {
    getSurvey.mockImplementation(async (surveyId: string) =>
      buildSurvey(surveyId, surveyId === OTHER_SURVEY_ID ? OTHER_WORKSPACE_ID : WORKSPACE_ID)
    );

    await expect(
      resolveFormbricksMappingsInput(
        [
          { surveyId: SURVEY_ID, elementIds: ["el-text"] },
          { surveyId: OTHER_SURVEY_ID, elementIds: ["el-text"] },
        ],
        WORKSPACE_ID
      )
    ).rejects.toThrow(ResourceNotFoundError);
  });

  test("rejects a survey that does not exist", async () => {
    getSurvey.mockResolvedValue(null);

    await expect(
      resolveFormbricksMappingsInput([{ surveyId: SURVEY_ID, elementIds: ["el-text"] }], WORKSPACE_ID)
    ).rejects.toThrow(ResourceNotFoundError);
  });

  test("skips unknown element ids and element types with no Hub field", async () => {
    getSurvey.mockResolvedValue(buildSurvey(SURVEY_ID, WORKSPACE_ID));

    const result = await resolveFormbricksMappingsInput(
      [{ surveyId: SURVEY_ID, elementIds: ["el-text", "el-gone", "el-file"] }],
      WORKSPACE_ID
    );

    expect(result.mappings).toEqual([{ surveyId: SURVEY_ID, elementId: "el-text", hubFieldType: "text" }]);
  });

  test("throws InvalidInputError when nothing is mappable", async () => {
    getSurvey.mockResolvedValue(buildSurvey(SURVEY_ID, WORKSPACE_ID));

    await expect(
      resolveFormbricksMappingsInput([{ surveyId: SURVEY_ID, elementIds: ["el-file"] }], WORKSPACE_ID)
    ).rejects.toThrow(InvalidInputError);
  });
});

describe("reconcileMappingsAgainstSurvey", () => {
  const blocks = [
    {
      elements: [
        { id: "el-text", type: "openText" },
        { id: "el-nps", type: "nps" },
      ],
    },
    {
      elements: [
        { id: "el-rating", type: "rating" },
        { id: "el-csat", type: "csat" },
      ],
    },
  ];

  test("returns empty delta when nothing changed", () => {
    const storedMappings = [
      { elementId: "el-text", hubFieldType: "text" as const },
      { elementId: "el-nps", hubFieldType: "nps" as const },
    ];

    const result = reconcileMappingsAgainstSurvey(storedMappings, blocks);
    expect(result).toEqual({ toDelete: [], toUpdate: [] });
  });

  test("returns toDelete for elements removed from survey", () => {
    const storedMappings = [
      { elementId: "el-text", hubFieldType: "text" as const },
      { elementId: "el-gone", hubFieldType: "text" as const },
      { elementId: "el-another-gone", hubFieldType: "rating" as const },
    ];

    const result = reconcileMappingsAgainstSurvey(storedMappings, blocks);
    expect(result.toDelete).toEqual(["el-gone", "el-another-gone"]);
    expect(result.toUpdate).toEqual([]);
  });

  test("returns toUpdate when element type changed (hubFieldType stale)", () => {
    const storedMappings = [
      // el-nps was mapped as "text" but the survey now has it as "nps"
      { elementId: "el-nps", hubFieldType: "text" as const },
      // el-csat was mapped as "rating" but the survey now has it as "csat"
      { elementId: "el-csat", hubFieldType: "rating" as const },
    ];

    const result = reconcileMappingsAgainstSurvey(storedMappings, blocks);
    expect(result.toDelete).toEqual([]);
    expect(result.toUpdate).toEqual([
      { elementId: "el-nps", hubFieldType: "nps" },
      { elementId: "el-csat", hubFieldType: "csat" },
    ]);
  });

  test("handles mixed delete and update", () => {
    const storedMappings = [
      { elementId: "el-text", hubFieldType: "text" as const },    // unchanged
      { elementId: "el-nps", hubFieldType: "text" as const },      // type changed + update
      { elementId: "el-gone", hubFieldType: "rating" as const },   // removed + delete
    ];

    const result = reconcileMappingsAgainstSurvey(storedMappings, blocks);
    expect(result.toDelete).toEqual(["el-gone"]);
    expect(result.toUpdate).toEqual([{ elementId: "el-nps", hubFieldType: "nps" }]);
  });

  test("deleted element takes priority over type mismatch", () => {
    // If an elementId matches a removed element, it goes to toDelete even if the stored
    // hubFieldType would differ from the (current!) element. Since it's gone, there's nothing
    // to update.
    const storedMappings = [{ elementId: "el-gone", hubFieldType: "text" as const }];

    // There is no "el-gone" element in the survey; we can't diff types.
    const result = reconcileMappingsAgainstSurvey(storedMappings, blocks);
    expect(result.toDelete).toEqual(["el-gone"]);
    expect(result.toUpdate).toEqual([]);
  });

  test("empty stored mappings produce empty delta", () => {
    const result = reconcileMappingsAgainstSurvey([], blocks);
    expect(result).toEqual({ toDelete: [], toUpdate: [] });
  });

  test("empty survey blocks mark all as deleted", () => {
    const storedMappings = [{ elementId: "el-text", hubFieldType: "text" as const }];
    const result = reconcileMappingsAgainstSurvey(storedMappings, []);
    expect(result.toDelete).toEqual(["el-text"]);
    expect(result.toUpdate).toEqual([]);
  });
});
