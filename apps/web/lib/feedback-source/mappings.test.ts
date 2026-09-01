import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { resolveFormbricksMappingsInput } from "./mappings";

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
      // Neither survey had its full supported set selected.
      elementScope: "specific",
    });
  });

  // The scope is what later tells reconciliation whether a question added to one of these surveys
  // should be mapped automatically. Deriving it here — the one moment the full candidate set is
  // known — is the whole reason it is stored rather than inferred at reconcile time.
  describe("elementScope derivation", () => {
    // buildSurvey exposes el-text (openText), el-nps (nps), el-rating (rating) and el-file
    // (fileUpload, unmappable). "Everything" therefore means the three mappable ones.
    const EVERY_SUPPORTED_ELEMENT = ["el-text", "el-nps", "el-rating"];

    test("is 'all' when every mappable element of every mapped survey is selected", async () => {
      getSurvey.mockImplementation(async (surveyId: string) => buildSurvey(surveyId, WORKSPACE_ID));

      const result = await resolveFormbricksMappingsInput(
        [
          { surveyId: SURVEY_ID, elementIds: EVERY_SUPPORTED_ELEMENT },
          { surveyId: OTHER_SURVEY_ID, elementIds: EVERY_SUPPORTED_ELEMENT },
        ],
        WORKSPACE_ID
      );

      expect(result).toMatchObject({ elementScope: "all" });
    });

    // The unmappable element can never be selected, so its absence must not make the source look
    // curated — otherwise no survey containing a file upload could ever track everything.
    test("is 'all' even though the survey holds an element with no Hub field", async () => {
      getSurvey.mockImplementation(async (surveyId: string) => buildSurvey(surveyId, WORKSPACE_ID));

      const result = await resolveFormbricksMappingsInput(
        [{ surveyId: SURVEY_ID, elementIds: [...EVERY_SUPPORTED_ELEMENT, "el-file"] }],
        WORKSPACE_ID
      );

      expect(result).toMatchObject({ elementScope: "all" });
    });

    test("is 'specific' when one element is left out", async () => {
      getSurvey.mockImplementation(async (surveyId: string) => buildSurvey(surveyId, WORKSPACE_ID));

      const result = await resolveFormbricksMappingsInput(
        [{ surveyId: SURVEY_ID, elementIds: ["el-text", "el-nps"] }],
        WORKSPACE_ID
      );

      expect(result).toMatchObject({ elementScope: "specific" });
    });

    // One scope covers the whole source, so a curated selection on any mapped survey must pull the
    // source out of "all" — otherwise a later reconcile would re-add what was excluded there.
    test("is 'specific' when one of several surveys is curated", async () => {
      getSurvey.mockImplementation(async (surveyId: string) => buildSurvey(surveyId, WORKSPACE_ID));

      const result = await resolveFormbricksMappingsInput(
        [
          { surveyId: SURVEY_ID, elementIds: EVERY_SUPPORTED_ELEMENT },
          { surveyId: OTHER_SURVEY_ID, elementIds: ["el-text"] },
        ],
        WORKSPACE_ID
      );

      expect(result).toMatchObject({ elementScope: "specific" });
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
