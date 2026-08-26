import { describe, expect, test, vi } from "vitest";
import {
  type TEmbeddedValueResponse,
  deriveLegacyEmbeddedData,
} from "@formbricks/types/embedded-data-resolver";
import { TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import { TSurveyBlockLogic, TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TConditionGroup, TSingleCondition } from "@formbricks/types/surveys/logic";
import { TSurveyLogicAction } from "@formbricks/types/surveys/types";
import {
  addConditionBelow,
  buildServerEmbeddedValues,
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
  const mockSurvey: TJsWorkspaceStateSurvey = {
    id: "cm9gptbhg0000192zceq9ayuc",
    name: "Start from scratch‌‌‍‍‌‍‍‌‌‌‌‍‍‍‌‌‌‌‌‌‌‌‍‌‍‌‌",
    type: "link",
    status: "inProgress",
    welcomeCard: {
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
    blocks: [
      {
        id: "block1",
        name: "Block 1",
        elements: [
          {
            id: "vjniuob08ggl8dewl0hwed41",
            type: TSurveyElementTypeEnum.OpenText,
            headline: {
              default: "What would you like to know?‌‌‍‍‌‍‍‍‌‌‌‍‍‌‍‍‌‌‌‌‌‌‍‌‍‌‌",
            },
            required: true,
            charLimit: { enabled: false },
            inputType: "email",
            placeholder: {
              default: "example@email.com",
            },
          },
        ],
      },
    ],
    questions: [],
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
    // The rows are the only thing `getSurveyEmbeddedFields` reads since ENG-2412, so a fixture that
    // declares a variable has to carry the matching row — that is what a real survey read returns.
    embeddedFields: deriveLegacyEmbeddedData({
      variables: [{ id: "v", name: "num", type: "number", value: 0 }],
    }),
    displayOption: "displayOnce",
    recontactDays: null,
    displayLimit: null,
    autoClose: null,
    delay: 0,
    displayPercentage: null,
    isBackButtonHidden: false,
    isAutoProgressingEnabled: false,
    workspaceOverwrites: null,
    styling: null,
    showLanguageSwitch: null,
    languages: [],
    triggers: [],
    segment: null,
    recaptcha: null,
  };

  /** Overridden by several cases below; the rows have to match, since they are what is read. */
  const TWO_VARIABLES = [
    { id: "numVar", name: "numberVar", type: "number" as const, value: 5 },
    { id: "textVar", name: "textVar", type: "text" as const, value: "hello" },
  ];

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
    const logic: TSurveyBlockLogic = {
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
    const result = removeCondition(group, "c");
    expect(result).toBe(true);
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
    const base: TSurveyBlockLogicAction = { id: "A", objective: "requireAnswer", target: "q" };
    const calc = getUpdatedActionBody(base, "calculate");
    expect(calc.objective).toBe("calculate");
    const req = getUpdatedActionBody(calc, "requireAnswer");
    expect(req.objective).toBe("requireAnswer");
    const jump = getUpdatedActionBody(req, "jumpToBlock");
    expect(jump.objective).toBe("jumpToBlock");
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
    const actions: TSurveyBlockLogicAction[] = [
      {
        id: "a1",
        objective: "calculate",
        variableId: "v",
        operator: "add",
        value: { type: "static", value: 3 },
      },
      { id: "a2", objective: "requireAnswer", target: "q2" },
      { id: "a3", objective: "jumpToBlock", target: "q3" },
    ];
    const result = performActions(mockSurvey, actions, data, initialVars);
    expect(result.calculations.v).toBe(3);
    expect(result.requiredElementIds).toContain("q2");
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
    expect(evaluateLogic(mockSurvey, { f: "foo" }, vars, group(baseCond("isNotEmpty")), "en")).toBe(true);
    expect(evaluateLogic(mockSurvey, { f: "" }, vars, group(baseCond("isNotSet")), "en")).toBe(true);
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
        group({ ...baseCond("equals", "foo"), leftOperand: { type: "element", value: "notfound" } }),
        "en"
      )
    ).toBe(false);
  });

  test("performActions handles divide by zero, assign, concat, and missing variable", () => {
    const survey: TJsWorkspaceStateSurvey = {
      ...mockSurvey,
      variables: [{ id: "v", name: "num", type: "number", value: 0 }],
    };
    const data: TResponseData = { q: 2 };
    const actions: TSurveyBlockLogicAction[] = [
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
    const result = removeCondition(group, "notfound");
    expect(result).toBe(false);
    expect(group.conditions.length).toBe(2);
    duplicateCondition(group, "notfound");
    expect(group.conditions.length).toBe(2);
    createGroupFromResource(group, "notfound");
    expect(group.conditions.length).toBe(2);
    updateCondition(group, "notfound", { operator: "equals" });
    expect(group.conditions.length).toBe(2);
  });

  test("removeCondition returns false when condition not found in nested groups", () => {
    const nestedGroup: TConditionGroup = {
      id: "nested",
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
      id: "parent",
      connector: "and",
      conditions: [nestedGroup],
    };

    const result = removeCondition(group, "nonexistent");
    expect(result).toBe(false);
    expect(group.conditions).toHaveLength(1);
  });

  test("removeCondition successfully removes from nested groups and cleans up", () => {
    const nestedGroup: TConditionGroup = {
      id: "nested",
      connector: "and",
      conditions: [
        {
          id: "nestedC1",
          leftOperand: { type: "hiddenField", value: "nf1" },
          operator: "equals",
          rightOperand: { type: "static", value: "nv1" },
        },
        {
          id: "nestedC2",
          leftOperand: { type: "hiddenField", value: "nf2" },
          operator: "equals",
          rightOperand: { type: "static", value: "nv2" },
        },
      ],
    };

    const otherCondition: TSingleCondition = {
      id: "otherCondition",
      leftOperand: { type: "hiddenField", value: "other" },
      operator: "equals",
      rightOperand: { type: "static", value: "value" },
    };

    const group: TConditionGroup = {
      id: "parent",
      connector: "and",
      conditions: [nestedGroup, otherCondition],
    };

    const result = removeCondition(group, "nestedC1");
    expect(result).toBe(true);
    expect(group.conditions).toHaveLength(2);
    expect((group.conditions[0] as TConditionGroup).conditions).toHaveLength(1);
    expect((group.conditions[0] as TConditionGroup).conditions[0].id).toBe("nestedC2");
    expect(group.conditions[1].id).toBe("otherCondition");
  });

  test("removeCondition flattens group when nested group has only one condition left", () => {
    const deeplyNestedGroup: TConditionGroup = {
      id: "deepNested",
      connector: "or",
      conditions: [
        {
          id: "deepC1",
          leftOperand: { type: "hiddenField", value: "df1" },
          operator: "equals",
          rightOperand: { type: "static", value: "dv1" },
        },
      ],
    };

    const nestedGroup: TConditionGroup = {
      id: "nested",
      connector: "and",
      conditions: [
        {
          id: "nestedC1",
          leftOperand: { type: "hiddenField", value: "nf1" },
          operator: "equals",
          rightOperand: { type: "static", value: "nv1" },
        },
        deeplyNestedGroup,
      ],
    };

    const otherCondition: TSingleCondition = {
      id: "otherCondition",
      leftOperand: { type: "hiddenField", value: "other" },
      operator: "equals",
      rightOperand: { type: "static", value: "value" },
    };

    const group: TConditionGroup = {
      id: "parent",
      connector: "and",
      conditions: [nestedGroup, otherCondition],
    };

    // Remove the regular condition, leaving only the deeply nested group in the nested group
    const result = removeCondition(group, "nestedC1");
    expect(result).toBe(true);

    // The parent group should still have 2 conditions: the nested group and the other condition
    expect(group.conditions).toHaveLength(2);
    // The nested group should still be there but now contain only the deeply nested group
    expect(group.conditions[0].id).toBe("nested");
    expect((group.conditions[0] as TConditionGroup).conditions).toHaveLength(1);
    // The nested group should contain the flattened content from the deeply nested group
    expect((group.conditions[0] as TConditionGroup).conditions[0].id).toBe("deepC1");
    expect(group.conditions[1].id).toBe("otherCondition");
  });

  test("removeCondition removes empty groups after cleanup", () => {
    const emptyNestedGroup: TConditionGroup = {
      id: "emptyNested",
      connector: "and",
      conditions: [
        {
          id: "toBeRemoved",
          leftOperand: { type: "hiddenField", value: "f1" },
          operator: "equals",
          rightOperand: { type: "static", value: "v1" },
        },
      ],
    };

    const group: TConditionGroup = {
      id: "parent",
      connector: "and",
      conditions: [
        emptyNestedGroup,
        {
          id: "keepThis",
          leftOperand: { type: "hiddenField", value: "f2" },
          operator: "equals",
          rightOperand: { type: "static", value: "v2" },
        },
      ],
    };

    // Remove the only condition from the nested group
    const result = removeCondition(group, "toBeRemoved");
    expect(result).toBe(true);

    // The empty nested group should be removed, leaving only the other condition
    expect(group.conditions).toHaveLength(1);
    expect(group.conditions[0].id).toBe("keepThis");
  });

  test("deleteEmptyGroups with complex nested structure", () => {
    const deepEmptyGroup: TConditionGroup = { id: "deepEmpty", connector: "and", conditions: [] };
    const middleGroup: TConditionGroup = {
      id: "middle",
      connector: "or",
      conditions: [deepEmptyGroup],
    };
    const topGroup: TConditionGroup = {
      id: "top",
      connector: "and",
      conditions: [
        middleGroup,
        {
          id: "validCondition",
          leftOperand: { type: "hiddenField", value: "f" },
          operator: "equals",
          rightOperand: { type: "static", value: "v" },
        },
      ],
    };

    deleteEmptyGroups(topGroup);

    // Should remove the nested empty groups and keep only the valid condition
    expect(topGroup.conditions).toHaveLength(1);
    expect(topGroup.conditions[0].id).toBe("validCondition");
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
    const surveyWithQuestions: TJsWorkspaceStateSurvey = {
      ...mockSurvey,
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            ...mockSurvey.blocks[0].elements,
            {
              id: "numQuestion",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { default: "Number question" },
              required: true,
              inputType: "number",
              charLimit: { enabled: false },
            },
            {
              id: "mcSingle",
              type: TSurveyElementTypeEnum.MultipleChoiceSingle,
              headline: { default: "MC Single" },
              required: true,
              choices: [
                { id: "choice1", label: { default: "Choice 1" } },
                { id: "choice2", label: { default: "Choice 2" } },
                { id: "other", label: { default: "Other" } },
              ],
              shuffleOption: "none",
            },
            {
              id: "mcMulti",
              type: TSurveyElementTypeEnum.MultipleChoiceMulti,
              headline: { default: "MC Multi" },
              required: true,
              choices: [
                { id: "choice1", label: { default: "Choice 1" } },
                { id: "choice2", label: { default: "Choice 2" } },
              ],
              shuffleOption: "none",
            },
            {
              id: "matrixQ",
              type: TSurveyElementTypeEnum.Matrix,
              headline: { default: "Matrix Question" },
              required: true,
              rows: [
                { id: "row-1", label: { default: "Row 1" } },
                { id: "row-2", label: { default: "Row 2" } },
              ],
              columns: [
                { id: "col-1", label: { default: "Column 1" } },
                { id: "col-2", label: { default: "Column 2" } },
              ],
              shuffleOption: "none",
            },
            {
              id: "pictureQ",
              type: TSurveyElementTypeEnum.PictureSelection,
              allowMulti: false,
              headline: { default: "Picture Selection" },
              required: true,
              choices: [
                { id: "pic1", imageUrl: "url1" },
                { id: "pic2", imageUrl: "url2" },
              ],
            },
            {
              id: "dateQ",
              type: TSurveyElementTypeEnum.Date,
              format: "M-d-y",
              headline: { default: "Date Question" },
              required: true,
            },
            {
              id: "fileQ",
              type: TSurveyElementTypeEnum.FileUpload,
              allowMultipleFiles: false,
              headline: { default: "File Upload" },
              required: true,
            },
          ],
        },
      ],
      questions: [],
      variables: TWO_VARIABLES,
      embeddedFields: deriveLegacyEmbeddedData({ variables: TWO_VARIABLES }),
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
      leftOperand: { type: "element", value: "numQuestion" },
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
      leftOperand: { type: "element", value: "mcSingle" },
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
      leftOperand: { type: "element", value: "mcMulti" },
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
      leftOperand: { type: "element", value: "matrixQ", meta: { row: "0" } },
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
      leftOperand: { type: "element", value: "nonExistent" },
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
      leftOperand: { type: "element", value: "mcSingle" },
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
      leftOperand: { type: "element", value: "matrixQ", meta: { row: "999" } },
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
    const surveyWithVars: TJsWorkspaceStateSurvey = {
      ...mockSurvey,
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            ...mockSurvey.blocks[0].elements,
            {
              id: "question1",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { default: "Question 1" },
              required: true,
              inputType: "text",
              charLimit: { enabled: false },
            },
          ],
        },
      ],
      questions: [],
      variables: TWO_VARIABLES,
      embeddedFields: deriveLegacyEmbeddedData({ variables: TWO_VARIABLES }),
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
      rightOperand: { type: "element", value: "question1" },
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
    const surveyWithVars: TJsWorkspaceStateSurvey = {
      ...mockSurvey,
      variables: TWO_VARIABLES,
      embeddedFields: deriveLegacyEmbeddedData({ variables: TWO_VARIABLES }),
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
      value: { type: "element", value: "questionNum" },
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
      value: { type: "element", value: "questionText" },
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
      value: { type: "element", value: "nonExistentQuestion" },
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
    const surveyWithNumberInput: TJsWorkspaceStateSurvey = {
      ...mockSurvey,
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "numQuestion",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { default: "Number question" },
              required: true,
              inputType: "number",
              placeholder: { default: "Enter a number" },
              charLimit: { enabled: false },
            },
          ],
        },
      ],
      questions: [],
    };

    const condition: TSingleCondition = {
      id: "numCond",
      leftOperand: { type: "element", value: "numQuestion" },
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

/**
 * The server-side twin of `packages/surveys/src/lib/logic.ts`, exercised by quotas, the summary and
 * follow-up conditions — i.e. against ALREADY-STORED responses. ENG-1837 repointed the definition
 * lookup onto the EmbeddedData tables and deliberately left every value expression alone; these
 * tests pin both, and each one flips if a call site is later "simplified" onto `resolveEmbeddedValue`.
 */
describe("computed fields resolve through the inlined EmbeddedData rows", () => {
  const STORAGE_KEY = "cm9gptbhg0000192zceq9ayzz";

  const buildSurvey = (
    variables: TJsWorkspaceStateSurvey["variables"],
    embeddedFields?: TJsWorkspaceStateSurvey["embeddedFields"]
  ): TJsWorkspaceStateSurvey =>
    ({
      id: "cm9gptbhg0000192zceq9ayuc",
      name: "Survey",
      type: "link",
      status: "inProgress",
      welcomeCard: { enabled: false },
      questions: [],
      blocks: [{ id: "block1", name: "Block 1", elements: [] }],
      endings: [],
      variables,
      embeddedFields,
      hiddenFields: { enabled: true, fieldIds: ["plan"] },
      languages: [],
      triggers: [],
      styling: null,
      segment: null,
      recaptcha: null,
      autoClose: null,
      delay: 0,
      displayLimit: null,
      displayOption: "displayOnce",
      displayPercentage: null,
      recontactDays: null,
      showLanguageSwitch: null,
      isBackButtonHidden: false,
      isAutoProgressingEnabled: false,
      workspaceOverwrites: null,
    }) as unknown as TJsWorkspaceStateSurvey;

  const computedRow = (dataType: "number" | "string", defaultValue: number | string) => [
    {
      field: { name: "score", source: "computed" as const, dataType, defaultValue, locked: false },
      link: { storageKey: STORAGE_KEY },
    },
  ];

  const equalsStatic = (value: number | string): TConditionGroup => ({
    id: "group1",
    connector: "and",
    conditions: [
      {
        id: "condition1",
        operator: "equals",
        leftOperand: { type: "variable", value: STORAGE_KEY },
        rightOperand: { type: "static", value },
      },
    ],
  });

  test("the row's dataType wins over the legacy column's", () => {
    const legacyTextVariable = [
      { id: STORAGE_KEY, name: "score", type: "text" as const, value: "" },
    ] as TJsWorkspaceStateSurvey["variables"];

    expect(
      evaluateLogic(
        buildSurvey(legacyTextVariable, computedRow("number", 0)),
        {},
        { [STORAGE_KEY]: "42" },
        equalsStatic(42),
        "default"
      )
    ).toBe(true);

    expect(
      evaluateLogic(buildSurvey(legacyTextVariable), {}, { [STORAGE_KEY]: "42" }, equalsStatic(42), "default")
    ).toBe(false);
  });

  test("an empty row list means the survey has no computed fields, whatever the legacy column says", () => {
    // ENG-2412 removed the fallback: the rows are the whole answer, so a condition naming a field the
    // rows do not carry no longer resolves off `survey.variables`. Deleting a survey's rows now makes
    // its fields disappear rather than reappear.
    const legacyNumberVariable = [
      { id: STORAGE_KEY, name: "score", type: "number" as const, value: 0 },
    ] as TJsWorkspaceStateSurvey["variables"];

    expect(
      evaluateLogic(
        buildSurvey(legacyNumberVariable, []),
        {},
        { [STORAGE_KEY]: "42" },
        equalsStatic(42),
        "default"
      )
    ).toBe(false);
  });

  test("delta (a): a non-numeric stored value is still 0, not the declared default", () => {
    expect(
      evaluateLogic(
        buildSurvey([], computedRow("number", 5)),
        {},
        { [STORAGE_KEY]: "abc" },
        equalsStatic(0),
        "default"
      )
    ).toBe(true);
  });

  test('delta (a): a string field holding 0 is still "", not "0"', () => {
    expect(
      evaluateLogic(
        buildSurvey([], computedRow("string", "fallback")),
        {},
        { [STORAGE_KEY]: 0 },
        equalsStatic(""),
        "default"
      )
    ).toBe(true);
  });

  test('delta (d): a response missing the key evaluates as 0 / "", not the declared default', () => {
    expect(evaluateLogic(buildSurvey([], computedRow("number", 5)), {}, {}, equalsStatic(0), "default")).toBe(
      true
    );
    expect(
      evaluateLogic(buildSurvey([], computedRow("string", "gold")), {}, {}, equalsStatic(""), "default")
    ).toBe(true);
  });

  test("a number field compared against a hidden field still coerces the right operand", () => {
    // The engines' twin in packages/surveys pins this too; it is the branch the guard below sits in
    // front of, so both directions are asserted in both engines.
    const condition: TConditionGroup = {
      id: "group1",
      connector: "and",
      conditions: [
        {
          id: "condition1",
          operator: "equals",
          leftOperand: { type: "variable", value: STORAGE_KEY },
          rightOperand: { type: "hiddenField", value: "plan" },
        },
      ],
    };

    expect(
      evaluateLogic(
        buildSurvey([], computedRow("number", 0)),
        { plan: "42" },
        { [STORAGE_KEY]: 42 },
        condition,
        "default"
      )
    ).toBe(true);
  });

  /**
   * A condition can outlive the field it names: the variable is renamed or deleted, the logic rule
   * keeps the old storage key. The `dataType` read that drives the number coercion runs BEFORE the
   * operator switch, so an unguarded `undefined` throws there — and `evaluateSingleCondition`'s
   * try/catch turns that into a silent `false` rather than a visible crash, which on this side of the
   * fence quietly changes a quota's or a summary's answer. These assert the evaluated RESULT, not the
   * absence of a throw, precisely because the catch would hide one.
   */
  describe("a condition naming a field the survey no longer declares", () => {
    const staleOperand = (operator: TSingleCondition["operator"]): TConditionGroup => ({
      id: "group1",
      connector: "and",
      conditions: [
        {
          id: "condition1",
          operator,
          leftOperand: { type: "variable", value: "storage_key_of_a_deleted_variable" },
          rightOperand: { type: "hiddenField", value: "plan" },
        },
      ],
    });

    test("evaluates on its own merits instead of collapsing to false", () => {
      expect(
        evaluateLogic(
          buildSurvey([], computedRow("number", 0)),
          { plan: "42" },
          {},
          staleOperand("isNotSet"),
          "default"
        )
      ).toBe(true);
    });

    test("does not coerce the right operand, since the left operand's type is unknown", () => {
      expect(
        evaluateLogic(
          buildSurvey([], computedRow("number", 0)),
          { plan: "42" },
          {},
          staleOperand("isSet"),
          "default"
        )
      ).toBe(false);
    });
  });

  test('performCalculation seeds from 0 / "" and skips an undeclared field', () => {
    const calculate = (
      survey: TJsWorkspaceStateSurvey,
      action: TSurveyBlockLogicAction,
      data: TResponseData,
      calculations: TResponseVariables
    ) => performActions(survey, [action], data, calculations).calculations;

    expect(
      calculate(
        buildSurvey([], computedRow("number", 5)),
        {
          id: "a1",
          objective: "calculate",
          variableId: STORAGE_KEY,
          operator: "add",
          value: { type: "static", value: 3 },
        },
        {},
        {}
      )
    ).toEqual({ [STORAGE_KEY]: 3 });

    expect(
      calculate(
        buildSurvey([], computedRow("number", 5)),
        {
          id: "a1",
          objective: "calculate",
          variableId: "unknown_key",
          operator: "add",
          value: { type: "static", value: 3 },
        },
        {},
        {}
      )
    ).toEqual({});
  });
});

describe("reserved field operands, server engine (ENG-1840)", () => {
  const survey = {
    id: "survey1",
    name: "Survey 1",
    questions: [],
    blocks: [{ id: "block1", name: "Block 1", elements: [] }],
    variables: [],
    embeddedFields: [],
    hiddenFields: { enabled: true, fieldIds: [] },
    type: "link",
    status: "inProgress",
    languages: [],
    endings: [],
    welcomeCard: { enabled: false, showResponseCount: false, timeToFinish: false },
  } as unknown as TJsWorkspaceStateSurvey;

  const reservedGroup = (
    name: string,
    operator: TSingleCondition["operator"],
    rightOperand?: TSingleCondition["rightOperand"]
  ): TConditionGroup => ({
    id: "group1",
    connector: "and",
    conditions: [
      { id: "condition1", operator, leftOperand: { type: "reserved", value: name }, rightOperand },
    ],
  });

  const response = {
    id: "response1",
    surveyId: "survey1",
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:02:30.000Z"),
    finished: true,
    language: "de",
    data: {},
    variables: {},
    ttc: { _total: 150000 },
    meta: { country: "DE", url: "https://app.test/s/abc", source: "link" },
  } as unknown as TEmbeddedValueResponse;

  test("the full catalog resolves server-side, including server-only fields", () => {
    const values = buildServerEmbeddedValues(response, survey);

    expect(
      evaluateLogic(
        survey,
        {},
        {},
        reservedGroup("country", "equals", { type: "static", value: "DE" }),
        "en",
        values
      )
    ).toBe(true);
    // durationSeconds converts ttc milliseconds to seconds — 150000ms is 150s, so "> 60" holds.
    expect(
      evaluateLogic(
        survey,
        {},
        {},
        reservedGroup("durationSeconds", "isGreaterThan", { type: "static", value: 60 }),
        "en",
        values
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        survey,
        {},
        {},
        reservedGroup("durationSeconds", "isLessThan", { type: "static", value: 60 }),
        "en",
        values
      )
    ).toBe(false);
    expect(
      evaluateLogic(
        survey,
        {},
        {},
        reservedGroup("finished", "equals", { type: "static", value: "true" }),
        "en",
        values
      )
    ).toBe(true);
  });

  test("a declared field of the same name still wins server-side", () => {
    const values = buildServerEmbeddedValues({ ...response, data: { country: "Declared answer" } }, survey);

    expect(
      evaluateLogic(
        survey,
        {},
        {},
        reservedGroup("country", "equals", { type: "static", value: "Declared answer" }),
        "en",
        values
      )
    ).toBe(true);
    expect(
      evaluateLogic(
        survey,
        {},
        {},
        reservedGroup("country", "equals", { type: "static", value: "DE" }),
        "en",
        values
      )
    ).toBe(false);
  });

  test("an unknown reserved name and a missing map both read as unset", () => {
    const values = buildServerEmbeddedValues(response, survey);

    expect(evaluateLogic(survey, {}, {}, reservedGroup("notACatalogEntry", "isSet"), "en", values)).toBe(
      false
    );
    // Callers with no response in hand (quota screening) pass nothing and get unset, not a throw.
    expect(evaluateLogic(survey, {}, {}, reservedGroup("country", "isSet"), "en")).toBe(false);
  });

  test("THE GRANDFATHER RULE, ENG-2538: a DECLARED but EMPTY field still owns its name", () => {
    // Red before ENG-2538. `mergeReservedValues`' spread only demotes the reserved value behind a key
    // that *exists*, so a survey declaring an optional `url` resolved the page address for every
    // response where the respondent left it blank — the normal case for a hidden field. The survey
    // parameter is what lets `dropShadowedReservedEntries` remove the entry instead.
    const declaringSurvey = {
      ...survey,
      hiddenFields: { enabled: true, fieldIds: ["url"] },
      embeddedFields: [
        { field: { name: "url", source: "ingested", dataType: "string" }, link: { storageKey: "url" } },
      ],
    } as unknown as TJsWorkspaceStateSurvey;

    const values = buildServerEmbeddedValues(response, declaringSurvey);

    // Not merely outranked — absent. A consumer that falls back on a missing key (recall renders the
    // author's fallback text) must see nothing here, not the reserved value.
    expect(values).not.toHaveProperty("url");
    expect(evaluateLogic(survey, {}, {}, reservedGroup("url", "isSet"), "en", values)).toBe(false);
    // Everything the survey does NOT declare keeps resolving.
    expect(values.country).toBe("DE");
    expect(values.source).toBe("link");
  });

  test("an ELEMENT id shadows a reserved name too, before the question is answered", () => {
    const declaringSurvey = {
      ...survey,
      blocks: [{ id: "block1", name: "Block 1", elements: [{ id: "url", type: "openText" }] }],
    } as unknown as TJsWorkspaceStateSurvey;

    expect(buildServerEmbeddedValues(response, declaringSurvey)).not.toHaveProperty("url");
  });

  test("a NUMBER reserved entry reaches logic already typed, so no coercion is needed", () => {
    // The invariant that makes the `reserved` coercion arm defensive rather than load-bearing: the
    // catalog read seam runs `coerceToEmbeddedDataType`, so a number-dataType entry is a JS number
    // here, never a numeric string. If this goes red the seam stopped coercing and that arm became
    // load-bearing, which is the only reason it is worth pinning separately.
    expect(typeof buildServerEmbeddedValues(response, survey).durationSeconds).toBe("number");
  });

  test("the coercion arm converts a reserved value that arrives as a string anyway", () => {
    // `mergeReservedValues` overlays `response.data` on the projection unconditionally, so a reserved
    // key that is also a response key carries that raw string past the seam above. The map is passed
    // directly because no authoring flow produces that overlap today — the reserved-name guard
    // refuses declaring one — so this pins the arm's behaviour rather than reproducing a bug.
    const numberVariableSurvey = {
      ...survey,
      variables: [{ id: "var_duration", name: "duration", type: "number", value: 150 }],
      embeddedFields: [
        {
          field: { name: "duration", source: "computed", dataType: "number" },
          link: { storageKey: "var_duration" },
        },
      ],
    } as unknown as TJsWorkspaceStateSurvey;

    const group: TConditionGroup = {
      id: "group1",
      connector: "and",
      conditions: [
        {
          id: "condition1",
          operator: "equals",
          leftOperand: { type: "variable", value: "var_duration" },
          rightOperand: { type: "reserved", value: "durationSeconds" },
        },
      ],
    };

    expect(
      evaluateLogic(numberVariableSurvey, {}, { var_duration: 150 }, group, "en", {
        durationSeconds: "150",
      })
    ).toBe(true);
  });
});
