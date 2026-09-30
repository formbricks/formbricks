import { describe, expect, test, vi } from "vitest";
import { collectMatrixQuestions } from "./matrix-questions";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: {} }));

const matrix = (id: string, headline: string, rows: number, columns: number) => ({
  id,
  type: "matrix",
  headline: { default: headline },
  rows: Array.from({ length: rows }, (_, i) => ({ id: `r${i}`, label: { default: `Row ${i}` } })),
  columns: Array.from({ length: columns }, (_, i) => ({ id: `c${i}`, label: { default: `Col ${i}` } })),
});
const survey = (id: string, name: string, elements: unknown[]) => ({
  id,
  name,
  blocks: [{ id: `b-${id}`, elements }],
});

describe("collectMatrixQuestions", () => {
  test("lists only matrix questions, labelled as ingestion labels their records", () => {
    const surveys = [
      survey("s1", "Onboarding", [
        matrix("m1", "Rate the setup", 3, 5),
        { id: "t1", type: "openText", headline: { default: "Anything else?" } },
      ]),
    ];
    const questions = collectMatrixQuestions(
      [
        { surveyId: "s1", elementId: "m1", customFieldLabel: null },
        { surveyId: "s1", elementId: "t1", customFieldLabel: null },
      ],
      surveys
    );

    expect(questions).toEqual([
      { label: "Rate the setup", rowCount: 3, columnCount: 5, surveyNames: ["Onboarding"] },
    ]);
  });

  test("a custom field label wins, and surveys sharing one label merge into one entry", () => {
    const surveys = [
      survey("s1", "EU", [matrix("m1", "Rate us", 3, 5)]),
      survey("s2", "US", [matrix("m2", "Rate our service", 4, 5)]),
    ];
    const questions = collectMatrixQuestions(
      [
        { surveyId: "s1", elementId: "m1", customFieldLabel: "Service grid" },
        { surveyId: "s2", elementId: "m2", customFieldLabel: "Service grid" },
      ],
      surveys
    );

    expect(questions).toEqual([
      { label: "Service grid", rowCount: 4, columnCount: 5, surveyNames: ["EU", "US"] },
    ]);
  });

  test("skips mappings whose survey or element is gone", () => {
    expect(
      collectMatrixQuestions(
        [
          { surveyId: "missing", elementId: "m1", customFieldLabel: null },
          { surveyId: "s1", elementId: "gone", customFieldLabel: null },
        ],
        [survey("s1", "S", [matrix("m1", "Q", 1, 1)])]
      )
    ).toEqual([]);
  });
});
