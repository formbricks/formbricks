import { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  blockOwnsTarget,
  findIssueOwnerBlock,
  findRuleId,
  getElementToOpen,
  getIssueLocationDetail,
  getIssueSummaryLabel,
  mergeRepeatedIssues,
} from "./issue-summary";
import { TEditorIssue } from "./validation-issues";

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as TFunction;

const issue = (overrides: Partial<TEditorIssue>): TEditorIssue => ({
  key: "k",
  tab: "elements",
  targetId: "q1",
  level: "field",
  field: "headline",
  message: "Enter an option",
  location: "Block 1, Question 1",
  ...overrides,
});

// Only the fields these helpers read.
const survey = {
  blocks: [
    {
      id: "b1",
      logic: [{ id: "rule1" }],
      elements: [{ id: "q1", headline: { default: "<p>How   was <b>it</b>?</p>" } }],
    },
    { id: "b2", elements: [{ id: "q2", headline: { default: "" } }] },
  ],
} as unknown as TSurvey;

describe("issue summary helpers", () => {
  test("merges the same message in the same place into one counted entry, in summary order", () => {
    const flow = issue({ tab: "flow", message: "Pick a value" });
    const merged = mergeRepeatedIssues([flow, issue({ key: "a" }), issue({ key: "b" })]);

    expect(merged.map(({ issue: found, count }) => [found.tab, count])).toEqual([
      ["elements", 2],
      ["flow", 1],
    ]);
  });

  test("keeps the same message on two different rules as two entries", () => {
    const first = issue({
      key: "a",
      tab: "flow",
      targetId: "rule1",
      location: null,
      message: "Pick a value",
    });
    const second = issue({
      key: "b",
      tab: "flow",
      targetId: "rule2",
      location: null,
      message: "Pick a value",
    });

    expect(mergeRepeatedIssues([first, second]).map(({ count }) => count)).toEqual([1, 1]);
  });

  test("labels a repeated entry with its count and a single one with its message", () => {
    expect(getIssueSummaryLabel(issue({}), 1, t)).toBe("Enter an option");
    expect(getIssueSummaryLabel(issue({}), 3, t)).toContain('"count":3');
  });

  test("names a question by its plain text, and nothing for what has none", () => {
    expect(getIssueLocationDetail(survey, issue({ targetId: "q1" }))).toBe("How was it?");
    expect(getIssueLocationDetail(survey, issue({ targetId: "q2" }))).toBeNull();
    expect(getIssueLocationDetail(survey, issue({ tab: "flow", targetId: "q1" }))).toBeNull();
  });

  test("finds the block that owns a block, a rule or a question", () => {
    expect(blockOwnsTarget(survey.blocks[0], "rule1")).toBe(true);
    expect(blockOwnsTarget(survey.blocks[0], "q2")).toBe(false);
    expect(findIssueOwnerBlock(survey, "q2")?.id).toBe("b2");
    expect(findIssueOwnerBlock(survey, "nope")).toBeUndefined();
  });

  test("knows which targets are rules", () => {
    expect(findRuleId(survey, "rule1")).toBe("rule1");
    expect(findRuleId(survey, "q1")).toBeNull();
  });

  test("opens a block's first question for the block's own issue, and the question itself otherwise", () => {
    expect(getElementToOpen(survey, "b1")).toBe("q1");
    expect(getElementToOpen(survey, "q2")).toBe("q2");
  });
});
