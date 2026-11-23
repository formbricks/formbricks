import { describe, expect, test } from "vitest";
import type { TResponse } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TWorkflowCondition, TWorkflowRunContext } from "@formbricks/workflows";
import { createChoiceAnswerReader } from "./choice-answers";
import { evaluateWorkflowCondition } from "./if-else";

// A two-language survey: a single select with "Other", a multi select without it.
const survey = {
  languages: [
    { default: true, enabled: true, language: { code: "en" } },
    { default: false, enabled: true, language: { code: "de" } },
  ],
  blocks: [
    {
      id: "block",
      elements: [
        {
          id: "plan",
          type: "multipleChoiceSingle",
          choices: [
            { id: "basic", label: { default: "Basic", de: "Einfach" } },
            { id: "pro", label: { default: "Pro", de: "Profi" } },
            { id: "other", label: { default: "Other", de: "Sonstiges" } },
          ],
        },
        {
          id: "tools",
          type: "multipleChoiceMulti",
          choices: [
            { id: "slack", label: { default: "Slack" } },
            { id: "teams", label: { default: "Teams" } },
          ],
        },
        { id: "comment", type: "openText" },
      ],
    },
  ],
} as unknown as TSurvey;

const reader = (language: string | null) =>
  createChoiceAnswerReader({ survey, response: { language } as TResponse });

const compare = (
  data: Record<string, unknown>,
  condition: Omit<TWorkflowCondition, "id">,
  language: string | null = "de"
): boolean => {
  const context: TWorkflowRunContext = { response: { data }, steps: {} };
  return evaluateWorkflowCondition({ id: "c", ...condition }, context, reader(language));
};

describe("choice conditions (DC11)", () => {
  test("an answer in the respondent's language matches its choice id", () => {
    const isBasic: Omit<TWorkflowCondition, "id"> = {
      left: { path: "response.plan" },
      operator: "equals",
      right: { choiceIds: ["basic"] },
    };

    expect(compare({ plan: "Einfach" }, isBasic)).toBe(true);
    expect(compare({ plan: "Profi" }, isBasic)).toBe(false);
    // The default language's labels sit under `default`, whatever the survey calls the language.
    expect(compare({ plan: "Basic" }, isBasic, "en")).toBe(true);
  });

  test("an answer given in another of the survey's languages still matches", () => {
    // A respondent who switched language mid-survey answered in English while the response says "de".
    expect(
      compare(
        { plan: "Pro" },
        { left: { path: "response.plan" }, operator: "equals", right: { choiceIds: ["pro"] } }
      )
    ).toBe(true);
  });

  test("an answer matching no choice is Other when the question offers it", () => {
    expect(
      compare(
        { plan: "Enterprise" },
        { left: { path: "response.plan" }, operator: "equals", right: { choiceIds: ["other"] } }
      )
    ).toBe(true);
  });

  test("list operators compare a multi select's answers by id", () => {
    const left = { path: "response.tools" };
    const data = { tools: ["Slack", "Teams"] };

    expect(compare(data, { left, operator: "includesAllOf", right: { choiceIds: ["slack", "teams"] } })).toBe(
      true
    );
    expect(compare(data, { left, operator: "includesOneOf", right: { choiceIds: ["teams"] } })).toBe(true);
    expect(compare(data, { left, operator: "doesNotIncludeOneOf", right: { choiceIds: ["slack"] } })).toBe(
      false
    );
    expect(
      compare(
        { plan: "Einfach" },
        { left: { path: "response.plan" }, operator: "equalsOneOf", right: { choiceIds: ["pro", "basic"] } }
      )
    ).toBe(true);
  });

  test("a question that isn't a choice question, or a run without a survey, has no answer to compare", () => {
    const context: TWorkflowRunContext = { response: { data: { plan: "Basic" } }, steps: {} };
    const isBasic: TWorkflowCondition = {
      id: "c",
      left: { path: "response.plan" },
      operator: "equals",
      right: { choiceIds: ["basic"] },
    };

    expect(evaluateWorkflowCondition(isBasic, context)).toBe(false);
    expect(
      compare(
        { comment: "basic" },
        { left: { path: "response.comment" }, operator: "equals", right: { choiceIds: ["basic"] } }
      )
    ).toBe(false);
  });
});
