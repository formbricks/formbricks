import { describe, expect, test } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  getBlockCodeIssueKey,
  getElementCodeIssues,
  getInvalidCodeElementIds,
  getOptionCodeLists,
  resetElementCodes,
  setElementCode,
  setOptionCode,
} from "./element-codes";

const mc = (id: string, code: string | undefined, choiceCodes: (string | undefined)[] = []) => ({
  id,
  type: "multipleChoiceSingle",
  code,
  headline: { default: id },
  required: true,
  choices: choiceCodes.map((c, i) => ({ id: `${id}-c${i}`, label: { default: `Option ${i}` }, code: c })),
});

const makeSurvey = (elements: unknown[][], extra: Record<string, unknown> = {}) =>
  ({
    id: "s",
    hiddenFields: { enabled: true, fieldIds: [] },
    variables: [],
    blocks: elements.map((els, i) => ({ id: `b${i}`, name: `Block ${i}`, elements: els })),
    ...extra,
  }) as unknown as TSurvey;

describe("getElementCodeIssues", () => {
  test("a survey without codes has no issues", () => {
    expect(getInvalidCodeElementIds(makeSurvey([[mc("a", undefined, [undefined])]])).size).toBe(0);
  });

  test("flags an invalid question code on its element only", () => {
    const survey = makeSurvey([[mc("a", "Q1"), mc("b", "q2")]]);
    const issues = getElementCodeIssues(survey);
    expect(issues.get("a")?.question?.kind).toBe("invalid_format");
    expect(issues.has("b")).toBe(false);
  });

  test("of two questions sharing a code both are marked, each pointing at the other", () => {
    const survey = makeSurvey([[mc("a", "q1")], [mc("b", "q1")]]);
    const issues = getElementCodeIssues(survey);
    expect(issues.get("b")?.question).toMatchObject({ kind: "duplicate_question_code", clashesWith: "a" });
    expect(issues.get("a")?.question).toMatchObject({ kind: "duplicate_question_code", clashesWith: "b" });
  });

  test("a code equal to an Embedded Data name is flagged", () => {
    const survey = makeSurvey([[mc("a", "region")]], {
      hiddenFields: { enabled: true, fieldIds: ["region"] },
    });
    expect(getElementCodeIssues(survey).get("a")?.question?.kind).toBe("clashes_embedded_data");
  });

  test("Embedded Data names come from the working copy's rows, not the legacy keys forwarded from mount", () => {
    const ingested = (name: string) =>
      ({
        field: { name, dataType: "string", source: "ingested", key: null, locked: false },
        link: { storageKey: name },
      }) as never;
    // A field added in the card is only in `embeddedFields`; one deleted there is still in `hiddenFields`.
    const survey = makeSurvey([[mc("a", "q1"), mc("b", "region")]], {
      embeddedFields: [ingested("q1")],
      hiddenFields: { enabled: true, fieldIds: ["region"] },
    });
    const issues = getElementCodeIssues(survey);
    expect(issues.get("a")?.question?.kind).toBe("clashes_embedded_data");
    expect(issues.has("b")).toBe(false);
  });

  test("answer code issues are keyed by list and option id", () => {
    const survey = makeSurvey([[mc("a", "q1", ["1", "1", "Bad"])]]);
    const issues = getElementCodeIssues(survey).get("a");
    expect(issues?.options.get("choices:a-c0")).toBeUndefined();
    expect(issues?.options.get("choices:a-c1")?.kind).toBe("duplicate_answer_code");
    expect(issues?.options.get("choices:a-c2")?.kind).toBe("invalid_format");
  });
});

describe("getBlockCodeIssueKey", () => {
  test("changes when another question starts to clash with a block's question, and only then", () => {
    const clean = makeSurvey([[mc("a", "q1")], [mc("b", "q2")]]);
    const clash = makeSurvey([[mc("a", "q1")], [mc("b", "q1")]]);
    const unrelated = makeSurvey([[mc("a", "q1")], [mc("b", "q3")]]);
    expect(getBlockCodeIssueKey(clean, clean.blocks[1])).not.toBe(
      getBlockCodeIssueKey(clash, clash.blocks[1])
    );
    expect(getBlockCodeIssueKey(clean, clean.blocks[0])).toBe(
      getBlockCodeIssueKey(unrelated, unrelated.blocks[0])
    );
  });
});

describe("getOptionCodeLists", () => {
  test("lists choices for choice questions and rows and columns for matrix, none for scales", () => {
    const m = {
      id: "m",
      type: "matrix",
      rows: [{ id: "r1", label: { default: "R" } }],
      columns: [{ id: "c1", label: { default: "C" } }],
    };
    expect(getOptionCodeLists(m as never).map((l) => l.key)).toEqual(["rows", "columns"]);
    expect(getOptionCodeLists(mc("a", undefined, [undefined]) as never).map((l) => l.key)).toEqual([
      "choices",
    ]);
    expect(getOptionCodeLists({ id: "n", type: "nps" } as never)).toEqual([]);
  });
});

describe("code updates", () => {
  test("setElementCode clears the code for an empty value", () => {
    expect(setElementCode("q1")).toEqual({ code: "q1" });
    expect(setElementCode("")).toEqual({ code: undefined });
  });

  test("setOptionCode changes one option and keeps the rest", () => {
    const element = mc("a", "q1", ["1", "2"]);
    const update = setOptionCode(element as never, "choices", "a-c1", "98");
    expect(update.choices?.map((c) => c.code)).toEqual(["1", "98"]);
    expect(update.choices?.[1].label).toEqual({ default: "Option 1" });
    expect(setOptionCode(element as never, "choices", "a-c1", "").choices?.[1].code).toBeUndefined();
  });

  test("resetElementCodes clears the question code and every answer code", () => {
    const update = resetElementCodes(mc("a", "q1", ["1", "2"]) as never);
    expect(update.code).toBeUndefined();
    expect(update.choices).toHaveLength(2);
    expect(update.choices?.every((c) => c.code === undefined)).toBe(true);
  });
});
