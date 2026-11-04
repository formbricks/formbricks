import { mockSurvey } from "@/app/api/(internal)/pipeline/lib/__mocks__/survey-follow-up.mock";
import { describe, expect, test } from "vitest";
import { ZSurvey } from "@formbricks/types/surveys/types";

/**
 * ENG-6778: question codes and answer codes survive `ZSurvey` (Zod strips unknown keys, so every
 * schema that lacks `code` would drop it silently) and `surveyRefinement` refuses bad ones.
 * Lives in apps/web because the complete `TSurvey` fixtures live here.
 */
const label = (text: string) => ({ default: text });

type TElementRecord = Record<string, unknown> & { choices?: { code?: string }[] };

const buildSurvey = (
  overrides: { hiddenFieldIds?: string[]; elementOverrides?: Record<string, unknown> } = {}
) => ({
  ...mockSurvey,
  followUps: [],
  questions: [],
  languages: [],
  endings: [],
  hiddenFields: { enabled: true, fieldIds: overrides.hiddenFieldIds ?? [] },
  blocks: [
    {
      id: "pa4bl0ckzx9hq2m8tnw3kvjd",
      name: "Block 1",
      elements: [
        {
          id: "Age",
          code: "q1",
          type: "multipleChoiceSingle",
          headline: label("Age?"),
          required: true,
          shuffleOption: "none",
          choices: [
            { id: "c1", code: "1", label: label("Young") },
            { id: "c2", code: "2", label: label("Old") },
          ],
          ...overrides.elementOverrides,
        },
        {
          id: "grid",
          code: "q2",
          type: "matrix",
          headline: label("Grid"),
          required: false,
          shuffleOption: "none",
          rows: [
            { id: "r1", code: "1", label: label("Row 1") },
            { id: "r2", code: "2", label: label("Row 2") },
          ],
          columns: [
            { id: "k1", code: "1", label: label("Col 1") },
            { id: "k2", code: "2", label: label("Col 2") },
          ],
        },
        {
          id: "pics",
          code: "q3",
          type: "pictureSelection",
          headline: label("Pick"),
          required: false,
          allowMulti: false,
          choices: [
            { id: "p1", code: "a", imageUrl: "https://example.com/a.jpg" },
            { id: "p2", code: "b", imageUrl: "https://example.com/b.jpg" },
          ],
        },
        {
          id: "intro",
          code: "should_not_stick",
          type: "cta",
          headline: label("Hi"),
          required: false,
          buttonExternal: false,
        },
      ],
    },
  ],
});

const issuesOf = (survey: unknown) =>
  ZSurvey.safeParse(survey).error?.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  })) ?? [];

describe("question codes in ZSurvey", () => {
  test("keeps codes on questions, options, matrix rows and columns and picture choices; CTA has none", () => {
    const result = ZSurvey.safeParse(buildSurvey());
    expect(result.error?.issues ?? []).toEqual([]);
    if (!result.success) return;

    const [single, matrix, pictures, cta] = result.data.blocks[0].elements as unknown as (TElementRecord & {
      rows: { code?: string }[];
      columns: { code?: string }[];
    })[];
    expect(single.code).toBe("q1");
    expect(single.choices?.map((choice) => choice.code)).toEqual(["1", "2"]);
    expect(matrix.code).toBe("q2");
    expect(matrix.rows.map((row) => row.code)).toEqual(["1", "2"]);
    expect(matrix.columns.map((column) => column.code)).toEqual(["1", "2"]);
    expect(pictures.choices?.map((choice) => choice.code)).toEqual(["a", "b"]);
    expect(cta).not.toHaveProperty("code");
  });

  test("a survey without any codes still parses", () => {
    const survey = buildSurvey();
    for (const element of survey.blocks[0].elements) delete (element as { code?: string }).code;
    expect(issuesOf(survey)).toEqual([]);
  });

  test("a malformed question code is reported at the element's code", () => {
    expect(issuesOf(buildSurvey({ elementOverrides: { code: "Q 1" } }))).toEqual([
      expect.objectContaining({ path: "blocks.0.elements.0.code" }),
    ]);
  });

  test("a duplicate answer code is reported at the second option", () => {
    const found = issuesOf(
      buildSurvey({
        elementOverrides: {
          choices: [
            { id: "c1", code: "1", label: label("Young") },
            { id: "c2", code: "1", label: label("Old") },
          ],
        },
      })
    );
    expect(found).toEqual([
      expect.objectContaining({
        path: "blocks.0.elements.0.choices.1.code",
        message: 'Answer code "1" is already used by option "c1" of question "Age".',
      }),
    ]);
  });

  test("a code equal to a hidden field name is refused", () => {
    expect(issuesOf(buildSurvey({ hiddenFieldIds: ["q1"] }))).toEqual([
      expect.objectContaining({
        path: "blocks.0.elements.0.code",
        message: 'Question code "q1" is already used by the Embedded Data field "q1".',
      }),
    ]);
  });
});
