import { describe, expect, test, vi } from "vitest";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { advanceFromBlock, startSurvey } from "./block-flow";
import { getBlockPreselection } from "./prefill";

/**
 * Pre-select answer (ENG-7437): a rule's `preselectAnswer` action reaches the page its question is on,
 * which opens with the answer given, in the respondent's language, unless the question already has one.
 */

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi.fn((value, language) =>
    typeof value === "object" ? value[language] || value["default"] || "" : value
  ),
}));

const status = {
  id: "status",
  type: TSurveyElementTypeEnum.MultipleChoiceSingle,
  headline: { default: "Inquiry status" },
  required: false,
  choices: [
    { id: "open", label: { default: "Open/Pending", de: "Offen" } },
    { id: "closed", label: { default: "Closed", de: "Geschlossen" } },
  ],
};
const topics = {
  id: "topics",
  type: TSurveyElementTypeEnum.MultipleChoiceMulti,
  headline: { default: "Topics" },
  required: false,
  choices: [
    { id: "billing", label: { default: "Billing" } },
    { id: "shipping", label: { default: "Shipping" } },
    { id: "other", label: { default: "Other" } },
  ],
};
const ein = {
  id: "ein",
  type: TSurveyElementTypeEnum.OpenText,
  inputType: "text",
  headline: { default: "EIN" },
  required: false,
};
const plan = {
  id: "plan",
  type: TSurveyElementTypeEnum.OpenText,
  inputType: "text",
  headline: { default: "Plan" },
  required: false,
};

const always = { id: "always", connector: "and" as const, conditions: [] };
const planIsBusiness = {
  id: "g",
  connector: "and" as const,
  conditions: [
    {
      id: "c",
      leftOperand: { type: "element" as const, value: "plan" },
      operator: "equals" as const,
      rightOperand: { type: "static" as const, value: "Business" },
    },
  ],
};

const preselectRule = (conditions: TSurveyBlockLogic["conditions"]): TSurveyBlockLogic => ({
  id: "rule",
  conditions,
  actions: [
    {
      id: "a1",
      objective: "preselectAnswer",
      target: "status",
      value: { type: "choices", choiceIds: ["open"] },
    },
    {
      id: "a2",
      objective: "preselectAnswer",
      target: "topics",
      value: { type: "choices", choiceIds: ["billing", "shipping"] },
    },
    { id: "a3", objective: "preselectAnswer", target: "ein", value: { type: "static", value: "0" } },
  ],
});

const makeSurvey = (
  logic: TSurveyBlockLogic[],
  startLogic: TSurveyBlockLogic[] | null = null
): TJsWorkspaceStateSurvey =>
  ({
    id: "survey1",
    name: "Survey",
    blocks: [
      { id: "b1", name: "b1", elements: [plan], logic },
      { id: "b2", name: "b2", elements: [status, topics, ein] },
    ],
    endings: [{ id: "end", type: "endScreen" }],
    variables: [],
    embeddedFields: [],
    welcomeCard: { enabled: false },
    languages: [],
    startLogic,
  }) as unknown as TJsWorkspaceStateSurvey;

const advance = (survey: TJsWorkspaceStateSurvey, submittedData: Record<string, string>) =>
  advanceFromBlock({
    survey,
    blockId: "b1",
    responseData: {},
    submittedData,
    variables: {},
    selectedLanguage: "default",
    reservedFieldValues: {},
  });

const page = (survey: TJsWorkspaceStateSurvey) => survey.blocks[1];

describe("Pre-select answer", () => {
  test("a matching rule pre-selects an option, several options and a free text value on the next page", () => {
    const survey = makeSurvey([preselectRule(planIsBusiness)]);
    const { preselections, nextBlockId } = advance(survey, { plan: "Business" });

    expect(nextBlockId).toBe("b2");
    expect(getBlockPreselection(page(survey), preselections, {}, "default")).toEqual({
      status: "Open/Pending",
      topics: ["Billing", "Shipping"],
      ein: "0",
    });
  });

  test("a rule whose condition doesn't match pre-selects nothing", () => {
    const survey = makeSurvey([preselectRule(planIsBusiness)]);
    const { preselections } = advance(survey, { plan: "Personal" });

    expect(preselections).toEqual({});
    expect(getBlockPreselection(page(survey), preselections, {}, "default")).toEqual({});
  });

  test("a changed pre-selection is the respondent's answer, and the page doesn't pre-select over it", () => {
    const survey = makeSurvey([preselectRule(always)]);
    const { preselections } = advance(survey, { plan: "Business" });
    // The respondent changed the status and cleared the topics before going Back and returning.
    const answers = { status: "Closed", topics: [] };

    expect(getBlockPreselection(page(survey), preselections, answers, "default")).toEqual({ ein: "0" });
  });

  test("labels the options in the respondent's language", () => {
    const survey = makeSurvey([preselectRule(always)]);
    const { preselections } = advance(survey, { plan: "x" });

    expect(getBlockPreselection(page(survey), preselections, {}, "de").status).toBe("Offen");
  });

  test("a rule before the first question pre-selects before anything is answered", () => {
    const survey = makeSurvey([], [preselectRule(always)]);
    const start = startSurvey({
      survey,
      responseData: {},
      variables: {},
      selectedLanguage: "default",
      reservedFieldValues: {},
    });

    expect(start.preselections.status).toEqual({ type: "choices", choiceIds: ["open"] });
  });

  test("a later action for the same question wins", () => {
    const rule = preselectRule(always);
    const survey = makeSurvey([
      rule,
      {
        id: "rule2",
        conditions: always,
        actions: [
          {
            id: "b1",
            objective: "preselectAnswer",
            target: "status",
            value: { type: "choices", choiceIds: ["closed"] },
          },
        ],
      },
    ]);

    expect(getBlockPreselection(page(survey), advance(survey, {}).preselections, {}, "default").status).toBe(
      "Closed"
    );
  });

  test("a pre-selection on a page the respondent never sees is never an answer", () => {
    // The rule jumps over the page with the pre-selected questions, straight to the ending.
    const survey = makeSurvey([
      {
        ...preselectRule(always),
        actions: [...preselectRule(always).actions, { id: "j", objective: "jumpToBlock", target: "end" }],
      },
    ]);
    const result = advance(survey, { plan: "Business" });

    expect(result.finished).toBe(true);
    expect(result.submittedData).toEqual({ plan: "Business" });
  });
});
