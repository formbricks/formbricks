import { describe, expect, test } from "vitest";
import {
  INITIAL_LOW_QUALITY_FLAG,
  type TLowQualityFlag,
  raiseLowQualityFlag,
  resumeLowQualityFlag,
  startLowQualityFlag,
  takeLowQualityFlag,
} from "./low-quality-flag";

/** The writes a respondent's submits make, each `true` when that submit's rule fired. */
const writesFor = (rulesFired: boolean[], start: TLowQualityFlag = INITIAL_LOW_QUALITY_FLAG) => {
  let flag = start;
  return rulesFired.map((fired) => {
    if (fired) flag = raiseLowQualityFlag(flag);
    const { send, next } = takeLowQualityFlag(flag);
    flag = next;
    return send;
  });
};

describe("the Low quality flag (ENG-6933, P42)", () => {
  test("rides on the write after the rule fires, and only that one", () => {
    expect(writesFor([false, true, false, false])).toEqual([false, true, false, false]);
  });

  test("is not sent again when Back and a second submit fire the rule again", () => {
    expect(writesFor([true, true])).toEqual([true, false]);
  });

  test("a session resumed after the flag was sent does not send it again", () => {
    expect(writesFor([true], { pending: false, sent: true })).toEqual([false]);
  });

  test("a flag raised before the first write rides on that write", () => {
    const raised = raiseLowQualityFlag(INITIAL_LOW_QUALITY_FLAG);
    expect(writesFor([false], raised)).toEqual([true]);
  });
});

describe("the Low quality flag of the rules before the first question (ENG-6952)", () => {
  test("a start rule that marked the response rides on its first write, and only that one", () => {
    expect(writesFor([false, false], startLowQualityFlag(true))).toEqual([true, false]);
    expect(writesFor([false, true], startLowQualityFlag(true))).toEqual([true, false]);
  });

  test("without a start rule marking it, the survey starts with no flag", () => {
    expect(writesFor([false, true], startLowQualityFlag(false))).toEqual([false, true]);
  });

  test("a resumed session whose flag was sent never sends it again, so a reviewer's restore holds", () => {
    expect(writesFor([false, true], resumeLowQualityFlag(true))).toEqual([false, false]);
  });

  test("a resumed session drops the flag this load's start rules raised: they ran when it began", () => {
    expect(writesFor([false], resumeLowQualityFlag(false))).toEqual([false]);
    expect(writesFor([false], resumeLowQualityFlag(undefined))).toEqual([false]);
    // A block rule after the resume still marks it, as it would have.
    expect(writesFor([true], resumeLowQualityFlag(false))).toEqual([true]);
  });
});
