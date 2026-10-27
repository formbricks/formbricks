import { describe, expect, test, vi } from "vitest";
import { type TV3SurveyDocument, ZV3CreateSurveyBody } from "./schemas";
import { validateV3SurveyDocument } from "./validation";

vi.mock("server-only", () => ({}));

/**
 * ENG-6778: v3 PATCH, the block routes and MCP skip `surveyRefinement`, so the code rules must run
 * from `validateV3SurveyDocument` too. These tests go through the real v3 body schema, so they also
 * prove no allow-list drops a `code` on the way in.
 */
type TOption = { code: string };
type TCoded = { code: string; choices: TOption[]; rows: TOption[]; columns: TOption[] };
const label = (text: string) => ({ "en-US": text });

const parseBody = (overrides: { elements?: Record<string, unknown>[]; hiddenFields?: string[] } = {}) =>
  ZV3CreateSurveyBody.parse({
    workspaceId: "clxx1234567890123456789012",
    name: "Coded",
    defaultLanguage: "en-US",
    ...(overrides.hiddenFields ? { hiddenFields: { enabled: true, fieldIds: overrides.hiddenFields } } : {}),
    blocks: [
      {
        id: "clbk1234567890123456789012",
        name: "Block",
        elements: overrides.elements ?? [
          {
            id: "age",
            code: "q1",
            type: "multipleChoiceSingle",
            headline: label("Age?"),
            required: true,
            shuffleOption: "none",
            choices: [
              { id: "c1", code: "1", label: label("Young") },
              { id: "c2", code: "2", label: label("Old") },
            ],
          },
          {
            id: "grid",
            code: "q2",
            type: "matrix",
            headline: label("Grid"),
            required: false,
            shuffleOption: "none",
            rows: [
              { id: "r1", code: "1", label: label("R1") },
              { id: "r2", code: "2", label: label("R2") },
            ],
            columns: [
              { id: "k1", code: "1", label: label("K1") },
              { id: "k2", code: "2", label: label("K2") },
            ],
          },
          {
            id: "pics",
            code: "q3",
            type: "pictureSelection",
            headline: label("Pick"),
            required: false,
            choices: [
              { id: "p1", code: "a", imageUrl: "https://example.com/a.jpg" },
              { id: "p2", code: "b", imageUrl: "https://example.com/b.jpg" },
            ],
          },
        ],
      },
    ],
  }) as unknown as TV3SurveyDocument;

const validate = (document: TV3SurveyDocument, baseline?: TV3SurveyDocument) =>
  validateV3SurveyDocument(document, baseline ? { mode: "introduced", baseline } : { mode: "enforce" })
    .invalidParams;

describe("v3 document validation of question and answer codes", () => {
  test("the body schema keeps every code, so nothing strips them", () => {
    const [single, matrix, pictures] = parseBody().blocks[0].elements as unknown as TCoded[];
    expect(single.code).toBe("q1");
    expect(single.choices.map((choice: { code: string }) => choice.code)).toEqual(["1", "2"]);
    expect(matrix.rows.map((row: { code: string }) => row.code)).toEqual(["1", "2"]);
    expect(matrix.columns.map((column: { code: string }) => column.code)).toEqual(["1", "2"]);
    expect(pictures.choices.map((choice: { code: string }) => choice.code)).toEqual(["a", "b"]);
  });

  test("a CTA element refuses a code instead of silently keeping one", () => {
    expect(() =>
      parseBody({
        elements: [
          {
            id: "hi",
            code: "q1",
            type: "cta",
            headline: label("Hi"),
            required: false,
            buttonExternal: false,
          },
        ],
      })
    ).toThrow();
  });

  test("a coded survey is valid", () => {
    expect(validate(parseBody())).toEqual([]);
  });

  test("a malformed question code is reported at its path", () => {
    const document = parseBody();
    (document.blocks[0].elements[0] as { code?: string }).code = "Q 1";
    expect(validate(document)).toEqual([
      expect.objectContaining({ name: "blocks.0.elements.0.code", reason: expect.stringContaining("Q 1") }),
    ]);
  });

  test("a duplicate answer code is a duplicate_identifier at the second option", () => {
    const document = parseBody();
    (document.blocks[0].elements[0] as unknown as { choices: { code: string }[] }).choices[1].code = "1";
    expect(validate(document)).toEqual([
      expect.objectContaining({
        name: "blocks.0.elements.0.choices.1.code",
        code: "duplicate_identifier",
        identifier: "1",
      }),
    ]);
  });

  test("a question code equal to a hidden field name is refused, ignoring case", () => {
    const issues = validate(parseBody({ hiddenFields: ["Q2"] }));
    expect(issues).toEqual([
      expect.objectContaining({
        name: "blocks.0.elements.1.code",
        code: "duplicate_identifier",
        reason: 'Question code "q2" is already used by the Embedded Data field "Q2".',
      }),
    ]);
  });

  test("a clash the baseline already had is reported on both sides, so callers can grandfather it", () => {
    const document = parseBody({ hiddenFields: ["q2"] });
    expect(validate(document, document)).toHaveLength(1);
  });
});
