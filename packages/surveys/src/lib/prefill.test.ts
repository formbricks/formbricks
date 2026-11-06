import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { getBlockPrefill } from "./prefill";

const element = (id: string, required = false) =>
  ({ id, type: TSurveyElementTypeEnum.OpenText, required }) as unknown as TSurveyElement;

// The page: why are you leaving, and a required follow-up shown if the answer is "monthly_fees".
const block = { elements: [element("reason", true), element("fees_detail", true)] };

describe("getBlockPrefill: what a page does with URL prefill", () => {
  test("applies the prefilled answers of the page", () => {
    expect(getBlockPrefill(block, { reason: "monthly_fees", other: "x" }, false)).toEqual({
      data: { reason: "monthly_fees" },
      autoSubmit: false,
    });
  });

  test("skipPrefilled skips the page only when every question on it is prefilled, a follow-up the prefill would reveal included", () => {
    // The follow-up is hidden on the first render; it still counts, so the page waits for it.
    expect(getBlockPrefill(block, { reason: "monthly_fees" }, true).autoSubmit).toBe(false);
    expect(getBlockPrefill(block, { reason: "monthly_fees", fees_detail: "too high" }, true)).toEqual({
      data: { reason: "monthly_fees", fees_detail: "too high" },
      autoSubmit: true,
    });
  });

  test("nothing prefilled is nothing to do", () => {
    expect(getBlockPrefill(block, {}, true)).toEqual({ data: {}, autoSubmit: false });
    expect(getBlockPrefill(block, undefined, true)).toEqual({ data: {}, autoSubmit: false });
  });
});
