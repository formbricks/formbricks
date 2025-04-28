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
  getLocalizedValue: (label: string) => label,
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
        type: "openText" as TSurveyQuestionTypeEnum.OpenText,
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
    const survey = {
      ...mockSurvey,
      variables: [{ id: "v", name: "num", type: "number" as const, value: 0 }],
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
});
