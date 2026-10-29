import { describe, expect, test } from "vitest";
import { TCodeIssue, validateSurveyCodes } from "@formbricks/types/surveys/codes";
import { TSurvey } from "@formbricks/types/surveys/types";
import en from "@/locales/en-US.json";
import { describeCodeIssue, getCodeClashLabel } from "./code-messages";

/** A `t` backed by the real en-US strings, so a test reads what the editor shows. */
const t = ((key: string, values?: Record<string, string | number>) => {
  const text = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en);
  if (typeof text !== "string") throw new Error(`Missing en-US key ${key}`);
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? `{${name}}`));
}) as unknown as Parameters<typeof describeCodeIssue>[2];

const element = (id: string, code: string | undefined, choiceCodes: string[] = []) => ({
  id,
  type: "multipleChoiceSingle",
  code,
  choices: choiceCodes.map((c, i) => ({ id: `${id}-c${i}`, code: c })),
});

const issuesOf = (elements: ReturnType<typeof element>[], embeddedDataNames: string[] = []): TCodeIssue[] =>
  validateSurveyCodes({ blocks: [{ elements }], embeddedDataNames });

const questionMessage = (code: string, clashLabel?: string) => {
  const [issue] = issuesOf([element("a", code)]);
  return describeCodeIssue(issue, "question", t, clashLabel);
};
const answerMessage = (code: string, clashLabel?: string) => {
  const issues = issuesOf([element("a", "q1", ["1", code])]);
  return describeCodeIssue(issues[0], "answer", t, clashLabel);
};

describe("describeCodeIssue for a question code", () => {
  test.each([
    ["Hello", "Start with a lowercase letter"],
    ["1abc", "Start with a lowercase letter"],
    ["_a", "Start with a lowercase letter"],
    ["my code", "Use only lowercase letters, digits and underscores"],
    ["a-b", "Use only lowercase letters, digits and underscores"],
    ["aB", "Use only lowercase letters, digits and underscores"],
    ["a__b", "Can't contain two underscores in a row"],
    ["hello_", "Can't end with an underscore"],
    ["a".repeat(31), "Use at most 30 characters"],
    ["all", "all is reserved in SPSS. Choose another code."],
    ["outcome", "outcome is the name of an export column. Choose another code."],
  ])("%s: %s", (code, message) => {
    expect(questionMessage(code)).toBe(message);
  });

  test("a duplicate names the question that has the code", () => {
    const issues = issuesOf([element("a", "q1"), element("b", "q1")]);
    expect(describeCodeIssue(issues[0], "question", t, "How are you? in Block 1")).toBe(
      "q1 is already used by How are you? in Block 1"
    );
  });

  test("a code that would repeat an export column of another question names that question", () => {
    const multi = { ...element("a", "q2", ["1"]), type: "multipleChoiceMulti" };
    const issues = issuesOf([multi, element("b", "q2_1")]);
    expect(describeCodeIssue(issues[0], "question", t, "Pick some in Block 1")).toBe(
      "q2_1 is already used by Pick some in Block 1"
    );
  });

  test("a code equal to an Embedded Data field names the field", () => {
    const issues = issuesOf([element("a", "region")], ["region"]);
    expect(describeCodeIssue(issues[0], "question", t)).toBe(
      "region is already used by the Embedded Data field region"
    );
  });

  test("a code equal to another question's ID names that ID", () => {
    const issues = issuesOf([element("abc", "q1"), element("b", "abc")]);
    expect(describeCodeIssue(issues[0], "question", t)).toBe(
      "abc is already used as the Question ID of another question"
    );
  });
});

describe("describeCodeIssue for an answer code", () => {
  test.each([
    ["_1", "Can't start with an underscore"],
    ["A", "Use only lowercase letters, digits and underscores"],
    ["1__2", "Can't contain two underscores in a row"],
    ["1_", "Can't end with an underscore"],
    ["1".repeat(21), "Use at most 20 characters"],
    ["to", "to is reserved in SPSS. Choose another code."],
  ])("%s: %s", (code, message) => {
    expect(answerMessage(code)).toBe(message);
  });

  test("a duplicate names the answer that has the code", () => {
    const issues = issuesOf([element("a", "q1", ["1", "1"])]);
    expect(describeCodeIssue(issues[0], "answer", t, "Hip Hop")).toBe("1 is already used by Hip Hop");
  });
});

describe("getCodeClashLabel", () => {
  const survey = {
    blocks: [
      {
        id: "b1",
        name: "Intro",
        elements: [
          { id: "a", type: "matrix", code: "q1", headline: { default: "<p>Rate these</p>" }, rows: [] },
          {
            id: "b",
            type: "multipleChoiceSingle",
            code: "q2",
            headline: { default: "Pick" },
            choices: [
              { id: "c0", label: { default: "Yes" }, code: "1" },
              { id: "c1", label: { default: "No" }, code: "1" },
            ],
          },
        ],
      },
    ],
  } as unknown as TSurvey;
  const issues = validateSurveyCodes({
    blocks: [...survey.blocks, { elements: [{ id: "z", type: "openText", code: "q1" }] }] as unknown[],
  });

  test("names the question and its block", () => {
    const issue = issues.find((candidate) => candidate.kind === "duplicate_question_code")!;
    expect(getCodeClashLabel(survey, issue, t)).toBe("Rate these in Intro");
  });

  test("names the answer by its label", () => {
    const issue = issues.find((candidate) => candidate.kind === "duplicate_answer_code")!;
    expect(getCodeClashLabel(survey, issue, t)).toBe("Yes");
  });
});
