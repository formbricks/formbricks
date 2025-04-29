import { describe, expect, test, vi } from "vitest";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import {
  TConditionGroup,
  TSingleCondition,
  TSurveyLogic,
  TSurveyLogicAction,
} from "@formbricks/types/surveys/types";
import {
  addConditionBelow,
  createGroupFromResource,
  deleteEmptyGroups,
  duplicateCondition,
  duplicateLogicItem,
  evaluateLogic,
  getUpdatedActionBody,
  performActions,
  removeCondition,
  toggleGroupConnector,
  updateCondition,
} from "./utils";

vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: (label: { default: string }) => label.default,
}));
vi.mock("@paralleldrive/cuid2", () => ({
  createId: () => "fixed-id",
}));

describe("surveyLogic", () => {
  const mockSurvey: TJsEnvironmentStateSurvey = {
    id: "cm9gptbhg0000192zceq9ayuc",
    name: "Start from scratch‌‌‍‍‌‍‍‌‌‌‌‍‍‍‌‌‌‌‌‌‌‌‍‌‍‌‌",
    type: "link",
    status: "inProgress",
    welcomeCard: {
      html: {
        default: "Thanks for providing your feedback - let's go!‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‌‍‌‌‌‌‌‍‌‍‌‌",
      },
      enabled: false,
      headline: {
        default: "Welcome!‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‌‍‌‌",
      },
      buttonLabel: {
        default: "Next‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‍‌‌‌‌‌‌‍‌‍‌‌",
      },
      timeToFinish: false,
      showResponseCount: false,
    },
    questions: [
      {
        id: "vjniuob08ggl8dewl0hwed41",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: {
          default: "What would you like to know?‌‌‍‍‌‍‍‍‌‌‌‍‍‌‍‍‌‌‌‌‌‌‍‌‍‌‌",
        },
        required: true,
        charLimit: {},
        inputType: "email",
        longAnswer: false,
        buttonLabel: {
          default: "Next‌‌‍‍‌‍‍‍‌‌‌‍‍‍‌‌‌‌‌‌‌‌‍‌‍‌‌",
        },
        placeholder: {
          default: "example@email.com",
        },
      },
    ],
    endings: [
      {
        id: "gt1yoaeb5a3istszxqbl08mk",
        type: "endScreen",
        headline: {
          default: "Thank you!‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‍‍‌‌‌‌‌‍‌‍‌‌",
        },
        subheader: {
          default: "We appreciate your feedback.‌‌‍‍‌‍‍‍‌‌‌‍‍‌‍‌‌‌‌‌‌‌‍‌‍‌‌",
        },
        buttonLink: "https://formbricks.com",
        buttonLabel: {
          default: "Create your own Survey‌‌‍‍‌‍‍‍‌‌‌‍‍‌‍‌‍‌‌‌‌‌‍‌‍‌‌",
        },
      },
    ],
    hiddenFields: {
      enabled: true,
      fieldIds: [],
    },
    variables: [
      {
        id: "v",
        name: "num",
        type: "number",
        value: 0,
      },
    ],
    displayOption: "displayOnce",
    recontactDays: null,
    displayLimit: null,
    autoClose: null,
    delay: 0,
    displayPercentage: null,
    isBackButtonHidden: false,
    projectOverwrites: null,
    styling: null,
    showLanguageSwitch: null,
    languages: [],
    triggers: [],
    segment: null,
  };

  const simpleGroup = (): TConditionGroup => ({
    id: "g1",
    connector: "and",
    conditions: [
      {
        id: "c1",
        leftOperand: { type: "hiddenField", value: "f1" },
        operator: "equals",
        rightOperand: { type: "static", value: "v1" },
      },
      {
        id: "c2",
        leftOperand: { type: "hiddenField", value: "f2" },
        operator: "equals",
        rightOperand: { type: "static", value: "v2" },
      },
    ],
  });

  test("duplicateLogicItem duplicates IDs recursively", () => {
    const logic: TSurveyLogic = {
      id: "L1",
      conditions: simpleGroup(),
      actions: [{ id: "A1", objective: "requireAnswer", target: "q1" }],
    };
    const dup = duplicateLogicItem(logic);
    expect(dup.id).toBe("fixed-id");
    expect(dup.conditions.id).toBe("fixed-id");
    expect(dup.actions[0].id).toBe("fixed-id");
  });

  test("addConditionBelow inserts after matched id", () => {
    const group = simpleGroup();
    const newCond: TSingleCondition = {
      id: "new",
      leftOperand: { type: "hiddenField", value: "x" },
      operator: "equals",
      rightOperand: { type: "static", value: "y" },
    };
    addConditionBelow(group, "c1", newCond);
    expect(group.conditions[1]).toEqual(newCond);
  });

  test("toggleGroupConnector flips connector", () => {
    const g = simpleGroup();
    toggleGroupConnector(g, "g1");
    expect(g.connector).toBe("or");
    toggleGroupConnector(g, "g1");
    expect(g.connector).toBe("and");
  });

  test("removeCondition deletes the condition and cleans empty groups", () => {
    const group: TConditionGroup = {
      id: "root",
      connector: "and",
      conditions: [
        {
          id: "c",
          leftOperand: { type: "hiddenField", value: "f" },
          operator: "equals",
          rightOperand: { type: "static", value: "" },
        },
      ],
    };
    removeCondition(group, "c");
    expect(group.conditions).toHaveLength(0);
  });

  test("duplicateCondition clones a condition in place", () => {
    const group = simpleGroup();
    duplicateCondition(group, "c1");
    expect(group.conditions[1].id).toBe("fixed-id");
  });

  test("deleteEmptyGroups removes nested empty groups", () => {
    const nested: TConditionGroup = { id: "n", connector: "and", conditions: [] };
    const root: TConditionGroup = { id: "r", connector: "and", conditions: [nested] };
    deleteEmptyGroups(root);
    expect(root.conditions).toHaveLength(0);
  });

  test("createGroupFromResource wraps item in new group", () => {
    const group = simpleGroup();
    createGroupFromResource(group, "c1");
    const g = group.conditions[0] as TConditionGroup;
    expect(g.conditions[0].id).toBe("c1");
    expect(g.connector).toBe("and");
  });

  test("updateCondition merges in partial changes", () => {
    const group = simpleGroup();
    updateCondition(group, "c1", { operator: "contains", rightOperand: { type: "static", value: "z" } });
    const updated = group.conditions.find((c) => c.id === "c1") as TSingleCondition;
    expect(updated?.operator).toBe("contains");
    expect(updated?.rightOperand?.value).toBe("z");
  });

  test("getUpdatedActionBody returns new action bodies correctly", () => {
    const base: TSurveyLogicAction = { id: "A", objective: "requireAnswer", target: "q" };
    const calc = getUpdatedActionBody(base, "calculate");
    expect(calc.objective).toBe("calculate");
    const req = getUpdatedActionBody(calc, "requireAnswer");
    expect(req.objective).toBe("requireAnswer");
    const jump = getUpdatedActionBody(req, "jumpToQuestion");
    expect(jump.objective).toBe("jumpToQuestion");
  });

  test("evaluateLogic handles AND/OR groups and single conditions", () => {
    const data: TResponseData = { f1: "v1", f2: "x" };
    const vars: TResponseVariables = {};
    const group: TConditionGroup = {
      id: "g",
      connector: "and",
      conditions: [
        {
          id: "c1",
          leftOperand: { type: "hiddenField", value: "f1" },
          operator: "equals",
          rightOperand: { type: "static", value: "v1" },
        },
        {
          id: "c2",
          leftOperand: { type: "hiddenField", value: "f2" },
          operator: "equals",
          rightOperand: { type: "static", value: "v2" },
        },
      ],
    };
    expect(evaluateLogic(mockSurvey, data, vars, group, "en")).toBe(false);
    group.connector = "or";
    expect(evaluateLogic(mockSurvey, data, vars, group, "en")).toBe(true);
  });

  test("performActions calculates, requires, and jumps correctly", () => {
    const data: TResponseData = { q: "5" };
    const initialVars: TResponseVariables = {};
    const actions: TSurveyLogicAction[] = [
      {
        id: "a1",
        objective: "calculate",
        variableId: "v",
        operator: "add",
        value: { type: "static", value: 3 },
      },
      { id: "a2", objective: "requireAnswer", target: "q2" },
      { id: "a3", objective: "jumpToQuestion", target: "q3" },
    ];
    const result = performActions(mockSurvey, actions, data, initialVars);
    expect(result.calculations.v).toBe(3);
    expect(result.requiredQuestionIds).toContain("q2");
    expect(result.jumpTarget).toBe("q3");
  });

  test("evaluateLogic handles all operators and error cases", () => {
    const baseCond = (operator: string, right: any = undefined) => ({
      id: "c",
      leftOperand: { type: "hiddenField", value: "f" },
      operator,
      ...(right !== undefined ? { rightOperand: { type: "static", value: right } } : {}),
    });
    const vars: TResponseVariables = {};
    const group = (cond: any) => ({ id: "g", connector: "and" as const, conditions: [cond] });
    expect(evaluateLogic(mockSurvey, { f: "foo" }, vars, group(baseCond("equals", "foo")), "en")).toBe(true);
    expect(evaluateLogic(mockSurvey, { f: "foo" }, vars, group(baseCond("doesNotEqual", "bar")), "en")).toBe(
      true
    );
    expect(evaluateLogic(mockSurvey, { f: "foo" }, vars, group(baseCond("contains", "o")), "en")).toBe(true);
    expect(evaluateLogic(mockSurvey, { f: "foo" }, vars, group(baseCond("doesNotContain", "z")), "en")).toBe(
      true
    );
    expect(evaluateLogic(mockSurvey, { f: "foo" }, vars, group(baseCond("startsWith", "f")), "en")).toBe(
      true
    );
    expect(
      evaluateLogic(mockSurvey, { f: "foo" }, vars, group(baseCond("doesNotStartWith", "z")), "en")
    ).toBe(true);
    expect(evaluateLogic(mockSurvey, { f: "foo" }, vars, group(baseCond("endsWith", "o")), "en")).toBe(true);
    expect(evaluateLogic(mockSurvey, { f: "foo" }, vars, group(baseCond("doesNotEndWith", "z")), "en")).toBe(
      true
    );
    expect(evaluateLogic(mockSurvey, { f: "foo" }, vars, group(baseCond("isSubmitted")), "en")).toBe(true);
    expect(evaluateLogic(mockSurvey, { f: "" }, vars, group(baseCond("isSkipped")), "en")).toBe(true);
    expect(
      evaluateLogic(
        mockSurvey,
        { fnum: 5 },
        vars,
        group({ ...baseCond("isGreaterThan", 2), leftOperand: { type: "hiddenField", value: "fnum" } }),
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        mockSurvey,
        { fnum: 1 },
        vars,
        group({ ...baseCond("isLessThan", 2), leftOperand: { type: "hiddenField", value: "fnum" } }),
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        mockSurvey,
        { fnum: 2 },
        vars,
        group({
          ...baseCond("isGreaterThanOrEqual", 2),
          leftOperand: { type: "hiddenField", value: "fnum" },
        }),
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        mockSurvey,
        { fnum: 2 },
        vars,
        group({ ...baseCond("isLessThanOrEqual", 2), leftOperand: { type: "hiddenField", value: "fnum" } }),
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        mockSurvey,
        { f: "foo" },
        vars,
        group({ ...baseCond("equalsOneOf", ["foo", "bar"]) }),
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        mockSurvey,
        { farr: ["foo", "bar"] },
        vars,
        group({ ...baseCond("includesAllOf", ["foo"]), leftOperand: { type: "hiddenField", value: "farr" } }),
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        mockSurvey,
        { farr: ["foo", "bar"] },
        vars,
        group({ ...baseCond("includesOneOf", ["foo"]), leftOperand: { type: "hiddenField", value: "farr" } }),
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        mockSurvey,
        { farr: ["foo", "bar"] },
        vars,
        group({
          ...baseCond("doesNotIncludeAllOf", ["baz"]),
          leftOperand: { type: "hiddenField", value: "farr" },
        }),
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        mockSurvey,
        { farr: ["foo", "bar"] },
        vars,
        group({
          ...baseCond("doesNotIncludeOneOf", ["baz"]),
          leftOperand: { type: "hiddenField", value: "farr" },
        }),
        "en"
      )
    ).toBe(true);
    expect(evaluateLogic(mockSurvey, { f: "accepted" }, vars, group(baseCond("isAccepted")), "en")).toBe(
      true
    );
    expect(evaluateLogic(mockSurvey, { f: "clicked" }, vars, group(baseCond("isClicked")), "en")).toBe(true);
    expect(
      evaluateLogic(
        mockSurvey,
        { f: "2024-01-02" },
        vars,
        group({ ...baseCond("isAfter", "2024-01-01") }),
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        mockSurvey,
        { f: "2024-01-01" },
        vars,
        group({ ...baseCond("isBefore", "2024-01-02") }),
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        mockSurvey,
        { fbooked: "booked" },
        vars,
        group({ ...baseCond("isBooked"), leftOperand: { type: "hiddenField", value: "fbooked" } }),
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        mockSurvey,
        { fobj: { a: "", b: "x" } },
        vars,
        group({ ...baseCond("isPartiallySubmitted"), leftOperand: { type: "hiddenField", value: "fobj" } }),
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        mockSurvey,
        { fobj: { a: "y", b: "x" } },
        vars,
        group({ ...baseCond("isCompletelySubmitted"), leftOperand: { type: "hiddenField", value: "fobj" } }),
        "en"
      )
    ).toBe(true);
    expect(evaluateLogic(mockSurvey, { f: "foo" }, vars, group(baseCond("isSet")), "en")).toBe(true);
    expect(evaluateLogic(mockSurvey, { f: "" }, vars, group(baseCond("isEmpty")), "en")).toBe(true);
    expect(
      evaluateLogic(mockSurvey, { f: "foo" }, vars, group({ ...baseCond("isAnyOf", ["foo", "bar"]) }), "en")
    ).toBe(true);
    // default/fallback
    expect(
      evaluateLogic(mockSurvey, { f: "foo" }, vars, group(baseCond("notARealOperator", "bar")), "en")
    ).toBe(false);
    // error handling
    expect(
      evaluateLogic(
        mockSurvey,
        {},
        vars,
        group({ ...baseCond("equals", "foo"), leftOperand: { type: "question", value: "notfound" } }),
        "en"
      )
    ).toBe(false);
  });

  test("performActions handles divide by zero, assign, concat, and missing variable", () => {
    const survey: TJsEnvironmentStateSurvey = {
      ...mockSurvey,
      variables: [{ id: "v", name: "num", type: "number", value: 0 }],
    };
    const data: TResponseData = { q: 2 };
    const actions: TSurveyLogicAction[] = [
      {
        id: "a1",
        objective: "calculate",
        variableId: "v",
        operator: "divide",
        value: { type: "static", value: 0 },
      },
      {
        id: "a2",
        objective: "calculate",
        variableId: "v",
        operator: "assign",
        value: { type: "static", value: 42 },
      },
      {
        id: "a3",
        objective: "calculate",
        variableId: "v",
        operator: "concat",
        value: { type: "static", value: "bar" },
      },
      {
        id: "a4",
        objective: "calculate",
        variableId: "notfound",
        operator: "add",
        value: { type: "static", value: 1 },
      },
    ];
    const result = performActions(survey, actions, data, {});
    expect(result.calculations.v).toBe("42bar");
    expect(result.calculations.notfound).toBeUndefined();
  });

  test("getUpdatedActionBody returns same action if objective matches", () => {
    const base: TSurveyLogicAction = { id: "A", objective: "requireAnswer", target: "q" };
    expect(getUpdatedActionBody(base, "requireAnswer")).toBe(base);
  });

  test("group/condition manipulation functions handle missing resourceId", () => {
    const group = simpleGroup();
    addConditionBelow(group, "notfound", {
      id: "x",
      leftOperand: { type: "hiddenField", value: "a" },
      operator: "equals",
      rightOperand: { type: "static", value: "b" },
    });
    expect(group.conditions.length).toBe(2);
    toggleGroupConnector(group, "notfound");
    expect(group.connector).toBe("and");
    removeCondition(group, "notfound");
    expect(group.conditions.length).toBe(2);
    duplicateCondition(group, "notfound");
    expect(group.conditions.length).toBe(2);
    createGroupFromResource(group, "notfound");
    expect(group.conditions.length).toBe(2);
    updateCondition(group, "notfound", { operator: "equals" });
    expect(group.conditions.length).toBe(2);
  });

  // Additional tests for complete coverage

  test("addConditionBelow with nested group correctly adds condition", () => {
    const nestedGroup: TConditionGroup = {
      id: "nestedGroup",
      connector: "and",
      conditions: [
        {
          id: "nestedC1",
          leftOperand: { type: "hiddenField", value: "nf1" },
          operator: "equals",
          rightOperand: { type: "static", value: "nv1" },
        },
      ],
    };

    const group: TConditionGroup = {
      id: "parentGroup",
      connector: "and",
      conditions: [nestedGroup],
    };

    const newCond: TSingleCondition = {
      id: "new",
      leftOperand: { type: "hiddenField", value: "x" },
      operator: "equals",
      rightOperand: { type: "static", value: "y" },
    };

    addConditionBelow(group, "nestedGroup", newCond);
    expect(group.conditions[1]).toEqual(newCond);

    addConditionBelow(group, "nestedC1", newCond);
    expect((group.conditions[0] as TConditionGroup).conditions[1]).toEqual(newCond);
  });

  test("getLeftOperandValue handles different question types", () => {
    const surveyWithQuestions: TJsEnvironmentStateSurvey = {
      ...mockSurvey,
      questions: [
        ...mockSurvey.questions,
        {
          id: "numQuestion",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Number question" },
          required: true,
          inputType: "number",
          charLimit: { enabled: false },
        },
        {
          id: "mcSingle",
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "MC Single" },
          required: true,
          choices: [
            { id: "choice1", label: { default: "Choice 1" } },
            { id: "choice2", label: { default: "Choice 2" } },
            { id: "other", label: { default: "Other" } },
          ],
          buttonLabel: { default: "Next" },
        },
        {
          id: "mcMulti",
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: { default: "MC Multi" },
          required: true,
          choices: [
            { id: "choice1", label: { default: "Choice 1" } },
            { id: "choice2", label: { default: "Choice 2" } },
          ],
          buttonLabel: { default: "Next" },
        },
        {
          id: "matrixQ",
          type: TSurveyQuestionTypeEnum.Matrix,
          headline: { default: "Matrix Question" },
          required: true,
          rows: [{ default: "Row 1" }, { default: "Row 2" }],
          columns: [{ default: "Column 1" }, { default: "Column 2" }],
          buttonLabel: { default: "Next" },
          shuffleOption: "none",
        },
        {
          id: "pictureQ",
          type: TSurveyQuestionTypeEnum.PictureSelection,
          allowMulti: false,
          headline: { default: "Picture Selection" },
          required: true,
          choices: [
            { id: "pic1", imageUrl: "url1" },
            { id: "pic2", imageUrl: "url2" },
          ],
          buttonLabel: { default: "Next" },
        },
        {
          id: "dateQ",
          type: TSurveyQuestionTypeEnum.Date,
          format: "M-d-y",
          headline: { default: "Date Question" },
          required: true,
          buttonLabel: { default: "Next" },
        },
        {
          id: "fileQ",
          type: TSurveyQuestionTypeEnum.FileUpload,
          allowMultipleFiles: false,
          headline: { default: "File Upload" },
          required: true,
          buttonLabel: { default: "Next" },
        },
      ],
      variables: [
        { id: "numVar", name: "numberVar", type: "number", value: 5 },
        { id: "textVar", name: "textVar", type: "text", value: "hello" },
      ],
    };

    const data: TResponseData = {
      numQuestion: 42,
      mcSingle: "Choice 1",
      mcMulti: ["Choice 1", "Choice 2"],
      matrixQ: { "Row 1": "Column 1" },
      pictureQ: ["pic1"],
      dateQ: "2024-01-15",
      fileQ: "file.pdf",
      unknownChoice: "Unknown option",
      multiWithUnknown: ["Choice 1", "Unknown option"],
    };

    const vars: TResponseVariables = {
      numVar: 10,
      textVar: "world",
    };

    // Test number question
    const numberCondition: TSingleCondition = {
      id: "numCond",
      leftOperand: { type: "question", value: "numQuestion" },
      operator: "equals",
      rightOperand: { type: "static", value: 42 },
    };
    expect(
      evaluateLogic(
        surveyWithQuestions,
        data,
        vars,
        { id: "g", connector: "and", conditions: [numberCondition] },
        "en"
      )
    ).toBe(true);

    // Test MC single with recognized choice
    const mcSingleCondition: TSingleCondition = {
      id: "mcCond",
      leftOperand: { type: "question", value: "mcSingle" },
      operator: "equals",
      rightOperand: { type: "static", value: "choice1" },
    };
    expect(
      evaluateLogic(
        surveyWithQuestions,
        data,
        vars,
        { id: "g", connector: "and", conditions: [mcSingleCondition] },
        "default"
      )
    ).toBe(true);

    // Test MC multi
    const mcMultiCondition: TSingleCondition = {
      id: "mcMultiCond",
      leftOperand: { type: "question", value: "mcMulti" },
      operator: "includesOneOf",
      rightOperand: { type: "static", value: ["choice1"] },
    };
    expect(
      evaluateLogic(
        surveyWithQuestions,
        data,
        vars,
        { id: "g", connector: "and", conditions: [mcMultiCondition] },
        "en"
      )
    ).toBe(true);

    // Test matrix question
    const matrixCondition: TSingleCondition = {
      id: "matrixCond",
      leftOperand: { type: "question", value: "matrixQ", meta: { row: "0" } },
      operator: "equals",
      rightOperand: { type: "static", value: "0" },
    };
    expect(
      evaluateLogic(
        surveyWithQuestions,
        data,
        vars,
        { id: "g", connector: "and", conditions: [matrixCondition] },
        "en"
      )
    ).toBe(true);

    // Test with variable type
    const varCondition: TSingleCondition = {
      id: "varCond",
      leftOperand: { type: "variable", value: "numVar" },
      operator: "equals",
      rightOperand: { type: "static", value: 10 },
    };
    expect(
      evaluateLogic(
        surveyWithQuestions,
        data,
        vars,
        { id: "g", connector: "and", conditions: [varCondition] },
        "en"
      )
    ).toBe(true);

    // Test with missing question
    const missingQuestionCondition: TSingleCondition = {
      id: "missingCond",
      leftOperand: { type: "question", value: "nonExistent" },
      operator: "equals",
      rightOperand: { type: "static", value: "foo" },
    };
    expect(
      evaluateLogic(
        surveyWithQuestions,
        data,
        vars,
        { id: "g", connector: "and", conditions: [missingQuestionCondition] },
        "en"
      )
    ).toBe(false);

    // Test with unknown value type in leftOperand
    const unknownTypeCondition: TSingleCondition = {
      id: "unknownCond",
      leftOperand: { type: "unknown" as any, value: "x" },
      operator: "equals",
      rightOperand: { type: "static", value: "x" },
    };
    expect(
      evaluateLogic(
        surveyWithQuestions,
        data,
        vars,
        { id: "g", connector: "and", conditions: [unknownTypeCondition] },
        "en"
      )
    ).toBe(false);

    // Test MC single with "other" option
    const otherCondition: TSingleCondition = {
      id: "otherCond",
      leftOperand: { type: "question", value: "mcSingle" },
      operator: "equals",
      rightOperand: { type: "static", value: "Unknown option" },
    };
    expect(
      evaluateLogic(
        surveyWithQuestions,
        data,
        vars,
        { id: "g", connector: "and", conditions: [otherCondition] },
        "en"
      )
    ).toBe(false);

    // Test matrix with invalid row index
    const invalidMatrixCondition: TSingleCondition = {
      id: "invalidMatrixCond",
      leftOperand: { type: "question", value: "matrixQ", meta: { row: "999" } },
      operator: "equals",
      rightOperand: { type: "static", value: "0" },
    };
    expect(
      evaluateLogic(
        surveyWithQuestions,
        data,
        vars,
        { id: "g", connector: "and", conditions: [invalidMatrixCondition] },
        "en"
      )
    ).toBe(false);
  });

  test("getRightOperandValue handles different data types and sources", () => {
    const surveyWithVars: TJsEnvironmentStateSurvey = {
      ...mockSurvey,
      questions: [
        ...mockSurvey.questions,
        {
          id: "question1",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Question 1" },
          required: true,
          inputType: "text",
          charLimit: { enabled: false },
        },
      ],
      variables: [
        { id: "numVar", name: "numberVar", type: "number", value: 5 },
        { id: "textVar", name: "textVar", type: "text", value: "hello" },
      ],
    };

    const vars: TResponseVariables = {
      numVar: 10,
      textVar: "world",
    };

    // Test with different rightOperand types
    const staticCondition: TSingleCondition = {
      id: "staticCond",
      leftOperand: { type: "hiddenField", value: "f" },
      operator: "equals",
      rightOperand: { type: "static", value: "test" },
    };

    const questionCondition: TSingleCondition = {
      id: "questionCond",
      leftOperand: { type: "hiddenField", value: "f" },
      operator: "equals",
      rightOperand: { type: "question", value: "question1" },
    };

    const variableCondition: TSingleCondition = {
      id: "varCond",
      leftOperand: { type: "hiddenField", value: "f" },
      operator: "equals",
      rightOperand: { type: "variable", value: "textVar" },
    };

    const hiddenFieldCondition: TSingleCondition = {
      id: "hiddenFieldCond",
      leftOperand: { type: "hiddenField", value: "f" },
      operator: "equals",
      rightOperand: { type: "hiddenField", value: "hiddenField1" },
    };

    const unknownTypeCondition: TSingleCondition = {
      id: "unknownCond",
      leftOperand: { type: "hiddenField", value: "f" },
      operator: "equals",
      rightOperand: { type: "unknown" as any, value: "x" },
    };

    expect(
      evaluateLogic(
        surveyWithVars,
        { f: "test" },
        vars,
        { id: "g", connector: "and", conditions: [staticCondition] },
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        surveyWithVars,
        { f: "response1", question1: "response1" },
        vars,
        { id: "g", connector: "and", conditions: [questionCondition] },
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        surveyWithVars,
        { f: "world" },
        vars,
        { id: "g", connector: "and", conditions: [variableCondition] },
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        surveyWithVars,
        { f: "hidden1", hiddenField1: "hidden1" },
        vars,
        { id: "g", connector: "and", conditions: [hiddenFieldCondition] },
        "en"
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        surveyWithVars,
        { f: "x" },
        vars,
        { id: "g", connector: "and", conditions: [unknownTypeCondition] },
        "en"
      )
    ).toBe(false);
  });

  test("performCalculation handles different variable types and operations", () => {
    const surveyWithVars: TJsEnvironmentStateSurvey = {
      ...mockSurvey,
      variables: [
        { id: "numVar", name: "numberVar", type: "number", value: 5 },
        { id: "textVar", name: "textVar", type: "text", value: "hello" },
      ],
    };

    const data: TResponseData = {
      questionNum: 20,
      questionText: "world",
      hiddenNum: 30,
    };

    // Test with variable value from another variable
    const varValueAction: TSurveyLogicAction = {
      id: "a1",
      objective: "calculate",
      variableId: "numVar",
      operator: "add",
      value: { type: "variable", value: "numVar" },
    };

    // Test with question value
    const questionValueAction: TSurveyLogicAction = {
      id: "a2",
      objective: "calculate",
      variableId: "numVar",
      operator: "add",
      value: { type: "question", value: "questionNum" },
    };

    // Test with hidden field value
    const hiddenFieldValueAction: TSurveyLogicAction = {
      id: "a3",
      objective: "calculate",
      variableId: "numVar",
      operator: "add",
      value: { type: "hiddenField", value: "hiddenNum" },
    };

    // Test with text variable for concat
    const textVarAction: TSurveyLogicAction = {
      id: "a4",
      objective: "calculate",
      variableId: "textVar",
      operator: "concat",
      value: { type: "question", value: "questionText" },
    };

    // Test with missing variable
    const missingVarAction: TSurveyLogicAction = {
      id: "a5",
      objective: "calculate",
      variableId: "nonExistentVar",
      operator: "add",
      value: { type: "static", value: 10 },
    };

    // Test with invalid value type (null)
    const invalidValueAction: TSurveyLogicAction = {
      id: "a6",
      objective: "calculate",
      variableId: "numVar",
      operator: "add",
      value: { type: "question", value: "nonExistentQuestion" },
    };

    // Test with other math operations
    const multiplyAction: TSurveyLogicAction = {
      id: "a7",
      objective: "calculate",
      variableId: "numVar",
      operator: "multiply",
      value: { type: "static", value: 2 },
    };

    const subtractAction: TSurveyLogicAction = {
      id: "a8",
      objective: "calculate",
      variableId: "numVar",
      operator: "subtract",
      value: { type: "static", value: 3 },
    };

    let result = performActions(surveyWithVars, [varValueAction], data, { numVar: 5 });
    expect(result.calculations.numVar).toBe(10); // 5 + 5

    result = performActions(surveyWithVars, [questionValueAction], data, { numVar: 5 });
    expect(result.calculations.numVar).toBe(25); // 5 + 20

    result = performActions(surveyWithVars, [hiddenFieldValueAction], data, { numVar: 5 });
    expect(result.calculations.numVar).toBe(35); // 5 + 30

    result = performActions(surveyWithVars, [textVarAction], data, { textVar: "hello" });
    expect(result.calculations.textVar).toBe("helloworld");

    result = performActions(surveyWithVars, [missingVarAction], data, {});
    expect(result.calculations.nonExistentVar).toBeUndefined();

    result = performActions(surveyWithVars, [invalidValueAction], data, { numVar: 5 });
    expect(result.calculations.numVar).toBe(5); // Unchanged

    result = performActions(surveyWithVars, [multiplyAction], data, { numVar: 5 });
    expect(result.calculations.numVar).toBe(10); // 5 * 2

    result = performActions(surveyWithVars, [subtractAction], data, { numVar: 5 });
    expect(result.calculations.numVar).toBe(2); // 5 - 3
  });

  test("evaluateLogic handles more complex nested condition groups", () => {
    const nestedGroup: TConditionGroup = {
      id: "nestedGroup",
      connector: "or",
      conditions: [
        {
          id: "c1",
          leftOperand: { type: "hiddenField", value: "f1" },
          operator: "equals",
          rightOperand: { type: "static", value: "v1" },
        },
        {
          id: "c2",
          leftOperand: { type: "hiddenField", value: "f2" },
          operator: "equals",
          rightOperand: { type: "static", value: "v2" },
        },
      ],
    };

    const deeplyNestedGroup: TConditionGroup = {
      id: "deepGroup",
      connector: "and",
      conditions: [
        {
          id: "d1",
          leftOperand: { type: "hiddenField", value: "f3" },
          operator: "equals",
          rightOperand: { type: "static", value: "v3" },
        },
        nestedGroup,
      ],
    };

    const rootGroup: TConditionGroup = {
      id: "rootGroup",
      connector: "and",
      conditions: [
        {
          id: "r1",
          leftOperand: { type: "hiddenField", value: "f4" },
          operator: "equals",
          rightOperand: { type: "static", value: "v4" },
        },
        deeplyNestedGroup,
      ],
    };

    // All conditions met
    expect(evaluateLogic(mockSurvey, { f1: "v1", f2: "v2", f3: "v3", f4: "v4" }, {}, rootGroup, "en")).toBe(
      true
    );

    // One condition in OR fails but group still passes
    expect(
      evaluateLogic(mockSurvey, { f1: "v1", f2: "wrong", f3: "v3", f4: "v4" }, {}, rootGroup, "en")
    ).toBe(true);

    // Both conditions in OR fail, causing AND to fail
    expect(
      evaluateLogic(mockSurvey, { f1: "wrong", f2: "wrong", f3: "v3", f4: "v4" }, {}, rootGroup, "en")
    ).toBe(false);

    // Top level condition fails
    expect(
      evaluateLogic(mockSurvey, { f1: "v1", f2: "v2", f3: "v3", f4: "wrong" }, {}, rootGroup, "en")
    ).toBe(false);
  });

  test("missing connector in group defaults to 'and'", () => {
    const group: TConditionGroup = {
      id: "g1",
      conditions: [
        {
          id: "c1",
          leftOperand: { type: "hiddenField", value: "f1" },
          operator: "equals",
          rightOperand: { type: "static", value: "v1" },
        },
        {
          id: "c2",
          leftOperand: { type: "hiddenField", value: "f2" },
          operator: "equals",
          rightOperand: { type: "static", value: "v2" },
        },
      ],
    } as any; // Intentionally missing connector

    createGroupFromResource(group, "c1");
    expect(group.connector).toBe("and");
  });

  test("getLeftOperandValue handles number input type with non-number value", () => {
    const surveyWithNumberInput: TJsEnvironmentStateSurvey = {
      ...mockSurvey,
      questions: [
        {
          id: "numQuestion",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Number question" },
          required: true,
          inputType: "number",
          placeholder: { default: "Enter a number" },
          buttonLabel: { default: "Next" },
          longAnswer: false,
          charLimit: {},
        },
      ],
    };

    const condition: TSingleCondition = {
      id: "numCond",
      leftOperand: { type: "question", value: "numQuestion" },
      operator: "equals",
      rightOperand: { type: "static", value: 0 },
    };

    // Test with non-numeric string
    expect(
      evaluateLogic(
        surveyWithNumberInput,
        { numQuestion: "not-a-number" },
        {},
        { id: "g", connector: "and", conditions: [condition] },
        "en"
      )
    ).toBe(false);

    // Test with empty string
    expect(
      evaluateLogic(
        surveyWithNumberInput,
        { numQuestion: "" },
        {},
        { id: "g", connector: "and", conditions: [condition] },
        "en"
      )
    ).toBe(false);
  });
});
