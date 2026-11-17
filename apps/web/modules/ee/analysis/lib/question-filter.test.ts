import { describe, expect, test } from "vitest";
import type { TAnswerQuestion } from "./answer-filter";
import { findNpsSegment, getNpsSegmentValueKeys, isNpsAnswerQuestion } from "./question-filter";

const scale = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => ({ value: String(from + index), label: "" }));
const question = (kind: TAnswerQuestion["kind"], options: TAnswerQuestion["options"]): TAnswerQuestion => ({
  id: "q",
  label: "Q",
  kind,
  options,
});

describe("NPS segments (ENG-7323)", () => {
  test("each segment stands for its scale points: detractor 0–6, passive 7–8, promoter 9–10", () => {
    expect(getNpsSegmentValueKeys("detractor")).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
    expect(getNpsSegmentValueKeys("passive")).toEqual(["7", "8"]);
    expect(getNpsSegmentValueKeys("promoter")).toEqual(["9", "10"]);
  });

  test("finds the segment whose points are exactly the values, in any order", () => {
    expect(findNpsSegment(["6", "5", "4", "3", "2", "1", "0"])).toBe("detractor");
    expect(findNpsSegment([10, 9])).toBe("promoter");
    expect(findNpsSegment(["7", "8"])).toBe("passive");
  });

  test("finds none for a partial, wider or repeated set", () => {
    expect(findNpsSegment(["0", "1"])).toBeNull();
    expect(findNpsSegment(["7", "8", "9"])).toBeNull();
    expect(findNpsSegment(["9", "9", "10"])).toBeNull();
    expect(findNpsSegment([])).toBeNull();
  });

  test("tells an NPS question (0–10) from a rating on 1–10 or a choice question", () => {
    expect(isNpsAnswerQuestion(question("number", scale(0, 10)))).toBe(true);
    expect(isNpsAnswerQuestion(question("number", scale(1, 10)))).toBe(false);
    expect(isNpsAnswerQuestion(question("choice", scale(0, 10)))).toBe(false);
    expect(isNpsAnswerQuestion(undefined)).toBe(false);
  });
});
