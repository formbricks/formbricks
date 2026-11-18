import { describe, expect, test } from "vitest";
import {
  type TWorkflowDefinitionBase,
  WORKFLOW_LIMITS,
  ZWorkflowCondition,
  ZWorkflowDefinition,
  ZWorkflowDefinitionInput,
  ZWorkflowEnableDefinition,
  ZWorkflowExecutableDefinition,
  toSurveyConditionOperator,
} from ".";

const surveyId = "cm9zr4mps000008l8btfy1vtz";

const sendEmailConfig = {
  from: "noreply@example.com",
  to: "jane@example.com",
  replyTo: [],
  subject: "Thanks",
  body: "We received your response.",
  attachResponseData: false,
};

const email = (id: string) => ({
  id,
  type: "action" as const,
  actionType: "send_email" as const,
  config: sendEmailConfig,
});

type TConditionInput = Record<string, unknown>;

const ifElse = (id: string, conditions: TConditionInput[]) => ({
  id,
  type: "if_else" as const,
  config: { condition: { id: `${id}-group`, connector: "and" as const, conditions } },
});

/** trigger → check → (then: then-email | else: else-email) */
const branching = (conditions: TConditionInput[]): TWorkflowDefinitionBase =>
  ({
    schemaVersion: 1,
    trigger: {
      id: "trigger",
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId, endingCardIds: [] },
    },
    nodes: [ifElse("check", conditions), email("then-email"), email("else-email")],
    edges: [
      { id: "e1", source: "trigger", target: "check" },
      { id: "e2", source: "check", target: "then-email", sourceHandle: "then" },
      { id: "e3", source: "check", target: "else-email", sourceHandle: "else" },
    ],
    entryNodeId: "trigger",
  }) as TWorkflowDefinitionBase;

const issues = (result: { success: boolean; error?: { issues: { message: string }[] } }): string[] =>
  result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? []);

describe("If/else operators", () => {
  test("accepts the survey operator names", () => {
    const definition = branching([
      { id: "c1", left: { path: "response.nps" }, operator: "isGreaterThan", right: 8 },
      { id: "c2", left: { path: "response.colors" }, operator: "includesOneOf", right: ["Red", "Blue"] },
      { id: "c3", left: { path: "response.email" }, operator: "isSet" },
    ]);

    expect(ZWorkflowExecutableDefinition.safeParse(definition).success).toBe(true);
  });

  test("still accepts the legacy workflow names and stores them as written", () => {
    const definition = branching([
      { id: "c1", left: { path: "response.nps" }, operator: "greaterEqual", right: 8 },
      { id: "c2", left: { path: "response.email" }, operator: "exists" },
    ]);

    const parsed = ZWorkflowDefinition.parse(definition);
    const node = parsed.nodes[0];
    expect(
      node.type === "if_else" && node.config.condition.conditions.map((c) => "operator" in c && c.operator)
    ).toEqual(["greaterEqual", "exists"]);
  });

  test("refuses a definition that mixes the two name sets", () => {
    const definition = branching([
      { id: "c1", left: { path: "response.nps" }, operator: "greaterThan", right: 8 },
      { id: "c2", left: { path: "response.email" }, operator: "isSet" },
    ]);

    expect(issues(ZWorkflowDefinition.safeParse(definition)).join()).toMatch(/mixes/);
  });

  test("names shared by both sets never count as a mix", () => {
    const definition = branching([
      { id: "c1", left: { path: "response.q1" }, operator: "equals", right: "a" },
      { id: "c2", left: { path: "response.q1" }, operator: "notContains", right: "b" },
      { id: "c3", left: { path: "response.q1" }, operator: "contains", right: "c" },
    ]);

    expect(ZWorkflowDefinition.safeParse(definition).success).toBe(true);
  });

  test("maps legacy names to the survey operator they mean", () => {
    expect(toSurveyConditionOperator("notEquals")).toBe("doesNotEqual");
    expect(toSurveyConditionOperator("lessEqual")).toBe("isLessThanOrEqual");
    expect(toSurveyConditionOperator("exists")).toBe("isSet");
    expect(toSurveyConditionOperator("notExists")).toBe("isNotSet");
    expect(toSurveyConditionOperator("isAfter")).toBe("isAfter");
  });

  test("list operators take a list or a Variable; others refuse a list", () => {
    const base = { id: "c", left: { path: "response.colors" } };
    expect(ZWorkflowCondition.safeParse({ ...base, operator: "includesAllOf", right: "Red" }).success).toBe(
      false
    );
    expect(
      ZWorkflowCondition.safeParse({ ...base, operator: "includesAllOf", right: { path: "response.other" } })
        .success
    ).toBe(true);
    expect(ZWorkflowCondition.safeParse({ ...base, operator: "equals", right: ["Red"] }).success).toBe(false);
    expect(ZWorkflowCondition.safeParse({ ...base, operator: "isSet", right: "x" }).success).toBe(false);
  });

  test("choice ids (DC11): one for equals and does not equal, any number for a list operator", () => {
    const base = { id: "c", left: { path: "response.plan" } };
    const parse = (operator: string, choiceIds: string[]) =>
      ZWorkflowCondition.safeParse({ ...base, operator, right: { choiceIds } }).success;

    expect(parse("equals", ["basic"])).toBe(true);
    expect(parse("doesNotEqual", ["basic"])).toBe(true);
    expect(parse("equals", ["basic", "pro"])).toBe(false);
    expect(parse("includesOneOf", ["basic", "pro"])).toBe(true);
    expect(parse("equalsOneOf", ["basic"])).toBe(true);
    // Text and number operators don't compare choices.
    expect(parse("contains", ["basic"])).toBe(false);
    expect(parse("isGreaterThan", ["basic"])).toBe(false);
    expect(parse("equals", [])).toBe(false);
  });

  test("refuses operators that need a survey element", () => {
    expect(
      ZWorkflowCondition.safeParse({ id: "c", left: { path: "response.q" }, operator: "isClicked" }).success
    ).toBe(false);
  });
});

describe("Filter step (ADR 0056)", () => {
  const filterDefinition = (conditions: TConditionInput[]): TWorkflowDefinitionBase =>
    ({
      schemaVersion: 1,
      trigger: {
        id: "trigger",
        type: "trigger",
        triggerType: "response.completed",
        config: { surveyId, endingCardIds: [] },
      },
      nodes: [
        { id: "gate", type: "filter", config: { condition: { id: "g", connector: "and", conditions } } },
        email("after"),
      ],
      edges: [
        { id: "e1", source: "trigger", target: "gate" },
        { id: "e2", source: "gate", target: "after" },
      ],
      entryNodeId: "trigger",
    }) as TWorkflowDefinitionBase;

  test("takes the If/else's conditions and has one way out", () => {
    const definition = filterDefinition([{ id: "c1", left: { path: "response.q1" }, operator: "isSet" }]);
    expect(ZWorkflowDefinitionInput.safeParse(definition).success).toBe(true);
    expect(ZWorkflowExecutableDefinition.safeParse(definition).success).toBe(true);

    const branched = {
      ...definition,
      edges: [...definition.edges.slice(0, 1), { ...definition.edges[1], sourceHandle: "then" }],
    };
    expect(ZWorkflowDefinition.safeParse(branched).success).toBe(false);
  });

  test("has the If/else's limits and Variable rules", () => {
    const tooMany = Array.from({ length: WORKFLOW_LIMITS.maxConditionsPerIfElse + 1 }, (_, index) => ({
      id: `c${index}`,
      left: { path: "response.q1" },
      operator: "isSet",
    }));
    expect(issues(ZWorkflowDefinitionInput.safeParse(filterDefinition(tooMany))).join()).toMatch(
      /filter step can have at most/
    );
    expect(
      ZWorkflowEnableDefinition.safeParse(
        filterDefinition([{ id: "c1", left: { path: "contact.plan" }, operator: "isSet" }])
      ).success
    ).toBe(false);
  });
});

describe("Variable paths in conditions", () => {
  test("refuses a path without one of the three prefixes on save", () => {
    const definition = branching([{ id: "c1", left: { path: "contact.plan" }, operator: "isSet" }]);
    expect(issues(ZWorkflowDefinitionInput.safeParse(definition)).join()).toMatch(
      /payload\., steps\., response\./
    );
  });

  test("choice ids compare only with a survey question's answer", () => {
    const withLeft = (path: string) =>
      branching([{ id: "c1", left: { path }, operator: "equals", right: { choiceIds: ["basic"] } }]);

    expect(ZWorkflowDefinitionInput.safeParse(withLeft("response.plan")).success).toBe(true);
    expect(issues(ZWorkflowDefinitionInput.safeParse(withLeft("payload.plan"))).join()).toMatch(
      /response\.<questionId>/
    );
  });

  test("refuses prototype segments on save", () => {
    const definition = branching([
      { id: "c1", left: { path: "response.q1" }, operator: "equals", right: { path: "steps.x.__proto__" } },
    ]);
    expect(ZWorkflowDefinitionInput.safeParse(definition).success).toBe(false);
  });

  test("refuses a path the rule rejects on enable", () => {
    const definition = branching([{ id: "c1", left: { path: "contact.plan" }, operator: "isSet" }]);
    expect(issues(ZWorkflowEnableDefinition.safeParse(definition)).join()).toMatch(
      /payload\., steps\., response\./
    );
  });

  test("still reads a stored If/else whose path predates the rule", () => {
    // Drafts saved before the Variable path rule could hold any path; reading them must not fail.
    const definition = branching([
      { id: "c1", left: { path: "data.q1", fallback: "x".repeat(2000) }, operator: "isSet" },
    ]);
    expect(ZWorkflowDefinition.safeParse(definition).success).toBe(true);
    expect(ZWorkflowDefinitionInput.safeParse(definition).success).toBe(false);
  });

  test("an executable If/else may only read steps that run before it", () => {
    const definition = branching([
      { id: "c1", left: { path: "steps.then-email.status" }, operator: "isSet" },
    ]);
    expect(ZWorkflowDefinition.safeParse(definition).success).toBe(true);
    expect(issues(ZWorkflowExecutableDefinition.safeParse(definition)).join()).toMatch(/runs before/);
  });

  test("an executable If/else can't read a source its trigger doesn't provide", () => {
    const definition = branching([{ id: "c1", left: { path: "payload.plan" }, operator: "isSet" }]);
    expect(issues(ZWorkflowExecutableDefinition.safeParse(definition)).join()).toMatch(/payload/);
  });
});

describe("graph shape", () => {
  test("a branch may be left empty: nothing runs on that side", () => {
    const definition = branching([{ id: "c1", left: { path: "response.q1" }, operator: "isSet" }]);
    definition.edges = definition.edges.filter((edge) => edge.sourceHandle !== "else");
    definition.nodes = definition.nodes.filter((node) => node.id !== "else-email");

    expect(ZWorkflowDefinition.safeParse(definition).success).toBe(true);
    expect(ZWorkflowExecutableDefinition.safeParse(definition).success).toBe(true);
  });

  test("each branch has at most one next step", () => {
    const definition = branching([{ id: "c1", left: { path: "response.q1" }, operator: "isSet" }]);
    definition.nodes.push(email("second-then"));
    definition.edges.push({ id: "e4", source: "check", target: "second-then", sourceHandle: "then" });

    expect(issues(ZWorkflowDefinition.safeParse(definition)).join()).toMatch(/at most one then edge/);
  });

  test("branches never join again", () => {
    const definition = branching([{ id: "c1", left: { path: "response.q1" }, operator: "isSet" }]);
    definition.edges[2] = { id: "e3", source: "check", target: "then-email", sourceHandle: "else" };
    definition.nodes = definition.nodes.filter((node) => node.id !== "else-email");

    expect(issues(ZWorkflowDefinitionInput.safeParse(definition)).join()).toMatch(/more than one incoming/);
    expect(issues(ZWorkflowExecutableDefinition.safeParse(definition)).join()).toMatch(
      /more than one incoming/
    );
    // A draft stored before the rule (If/else drafts were savable before it) still reads.
    expect(ZWorkflowDefinition.safeParse(definition).success).toBe(true);
  });

  test("an executable step other than If/else has at most one next step", () => {
    const definition = branching([{ id: "c1", left: { path: "response.q1" }, operator: "isSet" }]);
    definition.nodes.push(email("a"), email("b"));
    definition.edges.push(
      { id: "e4", source: "then-email", target: "a" },
      { id: "e5", source: "then-email", target: "b" }
    );

    expect(issues(ZWorkflowExecutableDefinition.safeParse(definition)).join()).toMatch(/one next step/);
  });
});

describe("save-time limits", () => {
  const overStepLimit = (): TWorkflowDefinitionBase => {
    const definition = branching([{ id: "c1", left: { path: "response.q1" }, operator: "isSet" }]);
    let previous = "then-email";
    for (let index = 0; index < WORKFLOW_LIMITS.maxSteps - 2; index += 1) {
      definition.nodes.push(email(`extra-${index}`));
      definition.edges.push({ id: `extra-edge-${index}`, source: previous, target: `extra-${index}` });
      previous = `extra-${index}`;
    }
    return definition;
  };

  test("a stored definition over a limit still reads and runs; saving or enabling it is refused", () => {
    const definition = overStepLimit();

    expect(ZWorkflowDefinition.safeParse(definition).success).toBe(true);
    expect(ZWorkflowExecutableDefinition.safeParse(definition).success).toBe(true);
    expect(issues(ZWorkflowDefinitionInput.safeParse(definition)).join()).toMatch(/at most 25 steps/);
    expect(issues(ZWorkflowEnableDefinition.safeParse(definition)).join()).toMatch(/at most 25 steps/);
  });

  test(`refuses more than ${WORKFLOW_LIMITS.maxSteps} steps`, () => {
    const definition = branching([{ id: "c1", left: { path: "response.q1" }, operator: "isSet" }]);
    let previous = "then-email";
    for (let index = 0; index < WORKFLOW_LIMITS.maxSteps - 2; index += 1) {
      definition.nodes.push(email(`extra-${index}`));
      definition.edges.push({ id: `extra-edge-${index}`, source: previous, target: `extra-${index}` });
      previous = `extra-${index}`;
    }

    expect(definition.nodes).toHaveLength(WORKFLOW_LIMITS.maxSteps + 1);
    expect(issues(ZWorkflowDefinitionInput.safeParse(definition)).join()).toMatch(/at most 25 steps/);
    definition.nodes.pop();
    definition.edges.pop();
    expect(ZWorkflowDefinitionInput.safeParse(definition).success).toBe(true);
  });

  test(`refuses more than ${WORKFLOW_LIMITS.maxConditionsPerIfElse} conditions in one If/else, nested ones included`, () => {
    const conditions = Array.from({ length: WORKFLOW_LIMITS.maxConditionsPerIfElse }, (_, index) => ({
      id: `c${index}`,
      left: { path: "response.q1" },
      operator: "isSet",
    }));
    expect(ZWorkflowDefinitionInput.safeParse(branching(conditions)).success).toBe(true);

    const nested = [...conditions.slice(1), { id: "g", connector: "or", conditions: conditions.slice(0, 2) }];
    expect(issues(ZWorkflowDefinitionInput.safeParse(branching(nested))).join()).toMatch(
      /at most 20 conditions/
    );
    expect(ZWorkflowDefinition.safeParse(branching(nested)).success).toBe(true);
  });
});
