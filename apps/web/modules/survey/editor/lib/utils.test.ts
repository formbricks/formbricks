import { describe, expect, test } from "vitest";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import {
  findEndingCardUsedInLogic,
  findHiddenFieldUsedInLogic,
  findOptionUsedInLogic,
  findQuestionUsedInLogic,
  findVariableUsedInLogic,
} from "./utils";

describe("Survey Logic Finder Utils", () => {
  // Mock survey data for testing
  const mockSurvey: TSurvey = {
    id: "survey1",
    name: "Test Survey",
    questions: [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Question 1" },
        required: false,
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
      {
        id: "q2",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { default: "Question 2" },
        required: false,
        choices: [
          { id: "opt1", label: { default: "Option 1" } },
          { id: "opt2", label: { default: "Option 2" } },
        ],

        logic: [
          {
            id: "logic1",
            conditions: {
              id: "condition1",
              connector: "and",
              conditions: [
                {
                  id: "cond1",
                  operator: "equals",
                  leftOperand: { type: "question", value: "q1" },
                  rightOperand: { type: "static", value: "test" },
                },
              ],
            },
            actions: [
              {
                id: "action1",
                objective: "jumpToQuestion",
                target: "q3",
              },
            ],
          },
        ],
        logicFallback: "q4",
      },
      {
        id: "q3",
        type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
        headline: { default: "Question 3" },
        required: false,

        choices: [
          { id: "opt1", label: { default: "Option 1" } },
          { id: "opt2", label: { default: "Option 2" } },
          { id: "opt3", label: { default: "Option 3" } },
        ],
        logic: [
          {
            id: "logic2",
            conditions: {
              id: "condition2",
              connector: "or",
              conditions: [
                {
                  id: "cond2",
                  operator: "equals",
                  leftOperand: { type: "question", value: "q2" },
                  rightOperand: { type: "static", value: "opt2" },
                },
              ],
            },
            actions: [
              {
                id: "action2",
                objective: "requireAnswer",
                target: "q4",
              },
            ],
          },
        ],
      },
      {
        id: "q4",
        type: TSurveyQuestionTypeEnum.Rating,
        headline: { default: "Question 4" },
        required: false,
        range: 5,
        isColorCodingEnabled: false,
        scale: "number",

        logic: [
          {
            id: "logic3",
            conditions: {
              id: "condition3",
              connector: "and",
              conditions: [
                {
                  id: "cond3",
                  operator: "equals",
                  leftOperand: { type: "variable", value: "var1" },
                  rightOperand: { type: "static", value: "value1" },
                },
                {
                  id: "cond4",
                  operator: "contains",
                  leftOperand: { type: "hiddenField", value: "field1" },
                  rightOperand: { type: "static", value: "test" },
                },
              ],
            },
            actions: [
              {
                id: "action3",
                objective: "calculate",
                variableId: "var2",
                operator: "add",
                value: { type: "static", value: 10 },
              },
              {
                id: "action4",
                objective: "jumpToQuestion",
                target: "ending1",
              },
            ],
          },
        ],
      },
    ],
    variables: [
      { id: "var1", name: "variable1", type: "text", value: "" },
      { id: "var2", name: "variable2", type: "number", value: 0 },
    ],
    hiddenFields: {
      enabled: true,
      fieldIds: ["field1", "field2"],
    },
    endings: [
      { id: "ending1", type: "endScreen", headline: { default: "Thank you" } },
      { id: "ending2", type: "redirectToUrl", url: "https://example.com" },
    ],
    autoClose: null,
    type: "link",
    delay: 0,
    displayLimit: 0,
    displayOption: "displayMultiple",
    displayPercentage: 0,
    isBackButtonHidden: false,
    segment: null,
    welcomeCard: {
      enabled: true,
      showResponseCount: true,
      timeToFinish: true,
    },
    autoComplete: 0,
    closeOnDate: null,

    triggers: [],
    styling: null,
    status: "inProgress",
    showLanguageSwitch: false,
    languages: [],
    projectOverwrites: null,
    recontactDays: null,
    runOnDate: null,
    isVerifyEmailEnabled: false,
    surveyClosedMessage: null,
    singleUse: {
      enabled: false,
      isEncrypted: true,
    },
    pin: null,
    resultShareKey: null,
    createdAt: new Date(),
    createdBy: "user1",
    updatedAt: new Date(),
    environmentId: "env1",
    followUps: [],
    isSingleResponsePerEmailEnabled: false,
  };

  describe("findQuestionUsedInLogic", () => {
    test("finds question used in condition", () => {
      const survey = mockSurvey;
      const index = findQuestionUsedInLogic(survey, "q1");
      expect(index).toBe(1); // q2 uses q1 in its logic conditions
    });

    test("finds question used as jump target", () => {
      const survey = mockSurvey;
      const index = findQuestionUsedInLogic(survey, "q3");
      expect(index).toBe(1); // q2 jumps to q3
    });

    test("returns -1 when question is not used", () => {
      const survey = mockSurvey;
      const index = findQuestionUsedInLogic(survey, "nonexistent");
      expect(index).toBe(-1); // nonexistent question is not used
    });

    test("ignores question referring to itself", () => {
      const survey = mockSurvey;
      const selfReferringSurvey: TSurvey = {
        ...survey,
        questions: [
          ...survey.questions,
          {
            id: "q5",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: { default: "Question 5" },
            required: false,
            charLimit: {
              enabled: false,
            },
            inputType: "text",
            logic: [
              {
                id: "logic5",
                conditions: {
                  id: "condition5",
                  connector: "and",
                  conditions: [
                    {
                      id: "cond5",
                      operator: "equals",
                      leftOperand: { type: "question", value: "q5" },
                      rightOperand: { type: "static", value: "test" },
                    },
                  ],
                },
                actions: [],
              },
            ],
          },
        ],
      };
      const index = findQuestionUsedInLogic(selfReferringSurvey, "q5");
      expect(index).toBe(-1); // question refers to itself, should be ignored
    });
  });

  describe("findOptionUsedInLogic", () => {
    test("finds option used in right operand", () => {
      const survey = mockSurvey;
      const index = findOptionUsedInLogic(survey, "q2", "opt2");
      expect(index).toBe(2); // q3 uses opt2 from q2
    });

    test("finds option used in left operand meta", () => {
      const survey = mockSurvey;
      const surveyWithMeta: TSurvey = {
        ...survey,
        questions: [
          ...survey.questions,
          {
            id: "q5",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: { default: "Question 5" },
            required: false,
            charLimit: {
              enabled: false,
            },
            inputType: "text",
            logic: [
              {
                id: "logic5",
                conditions: {
                  id: "condition5",
                  connector: "and",
                  conditions: [
                    {
                      id: "cond5",
                      operator: "equals",
                      leftOperand: {
                        type: "question",
                        value: "q2",
                        meta: { someValue: "opt1" },
                      },
                      rightOperand: { type: "static", value: "test" },
                    },
                  ],
                },
                actions: [],
              },
            ],
          },
        ],
      };
      const index = findOptionUsedInLogic(surveyWithMeta, "q2", "opt1", true);
      expect(index).toBe(4); // q5 uses opt1 in meta
    });

    test("finds option in array value right operand", () => {
      const survey = mockSurvey;
      const surveyWithArray: TSurvey = {
        ...survey,
        questions: [
          ...survey.questions,
          {
            id: "q5",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: { default: "Question 5" },
            required: false,
            charLimit: {
              enabled: false,
            },
            inputType: "text",
            logic: [
              {
                id: "logic5",
                conditions: {
                  id: "condition5",
                  connector: "and",
                  conditions: [
                    {
                      id: "cond5",
                      operator: "isAnyOf",
                      leftOperand: { type: "question", value: "q2" },
                      rightOperand: { type: "static", value: ["opt1", "other"] },
                    },
                  ],
                },
                actions: [],
              },
            ],
          },
        ],
      };
      const index = findOptionUsedInLogic(surveyWithArray, "q2", "opt1");
      expect(index).toBe(4); // q5 uses opt1 in array
    });

    test("returns -1 when option is not used", () => {
      const survey = mockSurvey;
      const index = findOptionUsedInLogic(survey, "q2", "nonexistent");
      expect(index).toBe(-1);
    });
  });

  describe("findVariableUsedInLogic", () => {
    test("finds variable used in left operand", () => {
      const survey = mockSurvey;
      const index = findVariableUsedInLogic(survey, "var1");
      expect(index).toBe(3); // q4 uses var1 in left operand
    });

    test("finds variable used in right operand", () => {
      const survey = mockSurvey;
      const surveyWithVarRightOp: TSurvey = {
        ...survey,
        questions: [
          {
            id: "q5",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: { default: "Question 5" },
            required: false,
            charLimit: {
              enabled: false,
            },
            inputType: "text",
            logic: [
              {
                id: "logic5",
                conditions: {
                  id: "condition5",
                  connector: "and",
                  conditions: [
                    {
                      id: "cond5",
                      operator: "equals",
                      leftOperand: { type: "question", value: "q1" },
                      rightOperand: { type: "variable", value: "var1" },
                    },
                  ],
                },
                actions: [],
              },
            ],
          },
        ],
      };
      console.log();
      const index = findVariableUsedInLogic(surveyWithVarRightOp, "var1");
      expect(index).toBe(0);
    });

    test("finds variable used in calculate action", () => {
      const survey = mockSurvey;
      const index = findVariableUsedInLogic(survey, "var2");
      expect(index).toBe(3); // q4 uses var2 in calculate action
    });

    test("returns -1 when variable is not used", () => {
      const survey = mockSurvey;
      const index = findVariableUsedInLogic(survey, "nonexistent");
      expect(index).toBe(-1);
    });
  });

  describe("findHiddenFieldUsedInLogic", () => {
    test("finds hidden field used in left operand", () => {
      const survey = mockSurvey;
      const index = findHiddenFieldUsedInLogic(survey, "field1");
      expect(index).toBe(3); // q4 uses field1 in left operand
    });

    test("finds hidden field used in right operand", () => {
      const survey = mockSurvey;
      const surveyWithHiddenRightOp: TSurvey = {
        ...survey,
        questions: [
          ...survey.questions,
          {
            id: "q5",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: { default: "Question 5" },
            required: false,
            charLimit: {
              enabled: false,
            },
            inputType: "text",
            logic: [
              {
                id: "logic5",
                conditions: {
                  id: "condition5",
                  connector: "and",
                  conditions: [
                    {
                      id: "cond5",
                      operator: "equals",
                      leftOperand: { type: "question", value: "q1" },
                      rightOperand: { type: "hiddenField", value: "field2" },
                    },
                  ],
                },
                actions: [],
              },
            ],
          },
        ],
      };
      const index = findHiddenFieldUsedInLogic(surveyWithHiddenRightOp, "field2");
      expect(index).toBe(4); // q5 uses field2 in right operand
    });

    test("returns -1 when hidden field is not used", () => {
      const survey = mockSurvey;
      const index = findHiddenFieldUsedInLogic(survey, "nonexistent");
      expect(index).toBe(-1);
    });
  });

  describe("findEndingCardUsedInLogic", () => {
    test("finds ending card used as jump target", () => {
      const survey = mockSurvey;
      const index = findEndingCardUsedInLogic(survey, "ending1");
      expect(index).toBe(3); // q4 jumps to ending1
    });

    test("finds ending card used as logic fallback", () => {
      const survey = mockSurvey;
      const fallbackSurvey = {
        ...survey,
        questions: survey.questions.map((q) => (q.id === "q1" ? { ...q, logicFallback: "ending2" } : q)),
      };
      const index = findEndingCardUsedInLogic(fallbackSurvey, "ending2");
      expect(index).toBe(0); // q1 has ending2 as fallback
    });

    test("returns -1 when ending card is not used", () => {
      const survey = mockSurvey;
      const index = findEndingCardUsedInLogic(survey, "nonexistent");
      expect(index).toBe(-1);
    });
  });
});
