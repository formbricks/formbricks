import { describe, expect, test } from "vitest";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { buildDataByQuestionCode, getQuestionCodes } from "./data-by-question-code";

describe("getQuestionCodes", () => {
  test("maps the Question ID of each coded question to its code and skips the uncoded ones", () => {
    const blocks = [
      {
        id: "b1",
        elements: [
          { id: "el1", type: "nps", code: "nps" },
          { id: "el2", type: "openText" },
        ],
      },
      {
        id: "b2",
        elements: [
          { id: "el3", type: "cta" },
          { id: "el4", type: "rating", code: "csat" },
        ],
      },
    ] as unknown as TSurveyBlock[];
    expect(getQuestionCodes(blocks)).toEqual({ el1: "nps", el4: "csat" });
  });
});

describe("buildDataByQuestionCode", () => {
  test("lists every coded question, null when nothing is stored, and leaves other keys out", () => {
    const byCode = buildDataByQuestionCode({ el1: 9, hidden: "x" }, { el1: "nps", el2: "why" });
    expect({ ...byCode }).toEqual({ nps: 9, why: null });
  });

  test("a code like `constructor` is an ordinary key", () => {
    const byCode = buildDataByQuestionCode({ el1: "a" }, { el1: "constructor" });
    expect(Object.getPrototypeOf(byCode)).toBeNull();
    expect(byCode.constructor).toBe("a");
  });
});
