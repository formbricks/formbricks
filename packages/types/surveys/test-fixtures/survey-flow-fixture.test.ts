import { describe, expect, test } from "vitest";
import { ZSurveyBlockLogicAction } from "../blocks";
import { TSurveyElementTypeEnum } from "../constants";
import { type TConditionGroup, type TSingleCondition, ZDynamicLogicFieldValue } from "../logic";
import { ZSurvey, ZSurveyEnding } from "../types";
import { isConditionGroup } from "../validation";
import { surveyFlowFixture } from "./survey-flow-fixture";

/**
 * The shared fixture survey of the Survey Flow Editor (ENG-6929). The validation, v3, outline-model
 * and E2E tests all read it, so "everything the API accepts renders in the Flow tab" is checked
 * against one source. Each later ticket adds its own constructs to it.
 *
 * The coverage checks below read the schema, not the fixture, for what "every construct" means: a
 * new action objective, operand type, ending type or question type added to the schema turns them
 * red until the fixture holds an example of it.
 */

/** The string literal(s) a Zod object pins `key` to: `z.literal("x")` or `z.literal(["x", "y"])`. */
const literalOf = (schema: unknown, key: string): string[] => {
  const shape = (schema as { shape?: Record<string, { def?: { values?: unknown[] } }> }).shape;
  const values = shape?.[key]?.def?.values ?? [];
  return values.filter((value): value is string => typeof value === "string");
};

const unionMembers = (schema: unknown): unknown[] => {
  const options = (schema as { options?: unknown[]; def?: { options?: unknown[]; in?: unknown } }).options;
  if (options) return options.flatMap((option) => unionMembers(option));
  const inner = (schema as { def?: { in?: unknown; schema?: unknown } }).def;
  if (inner?.in) return unionMembers(inner.in);
  if (inner?.schema) return unionMembers(inner.schema);
  return [schema];
};

const flattenConditions = (group: TConditionGroup): TSingleCondition[] =>
  group.conditions.flatMap((condition) =>
    isConditionGroup(condition) ? flattenConditions(condition) : [condition]
  );

const rules = surveyFlowFixture.blocks.flatMap((block) => block.logic ?? []);
const actions = rules.flatMap((rule) => rule.actions);
const conditions = rules.flatMap((rule) => flattenConditions(rule.conditions));

describe("the survey flow fixture", () => {
  test("is a valid survey", () => {
    const result = ZSurvey.safeParse(surveyFlowFixture);

    expect(result.error?.issues ?? []).toEqual([]);
  });

  test("holds every rule action objective the schema accepts", () => {
    const objectives = new Set(
      unionMembers(ZSurveyBlockLogicAction).flatMap((member) => literalOf(member, "objective"))
    );

    expect(objectives.size).toBeGreaterThan(0);
    expect(new Set(actions.map((action) => action.objective))).toEqual(objectives);
  });

  test("holds every condition operand type, on the left and as a right operand or calculate value", () => {
    const operandTypes = new Set(
      unionMembers(ZDynamicLogicFieldValue).flatMap((member) => literalOf(member, "type"))
    );

    expect(operandTypes.size).toBeGreaterThan(0);
    expect(new Set(conditions.map((condition) => condition.leftOperand.type))).toEqual(operandTypes);

    const rightTypes = new Set(conditions.flatMap((condition) => condition.rightOperand?.type ?? []));
    expect(rightTypes).toEqual(new Set([...operandTypes, "static"]));

    const calculateValueTypes = new Set(
      actions.flatMap((action) => (action.objective === "calculate" ? [action.value.type] : []))
    );
    expect(calculateValueTypes).toEqual(new Set([...operandTypes, "static"]));
  });

  test("calculates on both a number and a text field", () => {
    const calculateOperators = new Set(
      actions.flatMap((action) => (action.objective === "calculate" ? [action.operator] : []))
    );

    expect(calculateOperators).toEqual(
      new Set(["add", "subtract", "multiply", "divide", "assign", "concat"])
    );
  });

  test("jumps to a block and to an ending, and has a fallback", () => {
    const blockIds = new Set(surveyFlowFixture.blocks.map((block) => block.id));
    const endingIds = new Set(surveyFlowFixture.endings.map((ending) => ending.id));
    const jumpTargets = actions.flatMap((action) =>
      action.objective === "jumpToBlock" ? [action.target] : []
    );

    expect(jumpTargets.some((target) => blockIds.has(target))).toBe(true);
    expect(jumpTargets.some((target) => endingIds.has(target))).toBe(true);
    expect(surveyFlowFixture.blocks.some((block) => block.logicFallback)).toBe(true);
  });

  test("nests a condition group and uses a matrix row condition", () => {
    expect(rules.some((rule) => rule.conditions.conditions.some((item) => isConditionGroup(item)))).toBe(
      true
    );
    expect(
      conditions.some(
        (condition) => condition.leftOperand.type === "element" && condition.leftOperand.meta?.row
      )
    ).toBe(true);
  });

  test("has rules before the first question that screen out, jump to a block and set a value", () => {
    const blockIds = new Set(surveyFlowFixture.blocks.map((block) => block.id));
    const endingIds = new Set(surveyFlowFixture.endings.map((ending) => ending.id));
    const startActions = (surveyFlowFixture.startLogic ?? []).flatMap((rule) => rule.actions);
    const startJumps = startActions.flatMap((action) =>
      action.objective === "jumpToBlock" ? [action.target] : []
    );

    expect(startJumps.some((target) => endingIds.has(target))).toBe(true);
    expect(startJumps.some((target) => blockIds.has(target))).toBe(true);
    expect(startActions.some((action) => action.objective === "calculate")).toBe(true);
  });

  test("holds every ending type and every question type", () => {
    const endingTypes = new Set(unionMembers(ZSurveyEnding).flatMap((member) => literalOf(member, "type")));
    expect(new Set(surveyFlowFixture.endings.map((ending) => ending.type))).toEqual(endingTypes);

    const elementTypes = new Set(
      surveyFlowFixture.blocks.flatMap((block) => block.elements.map((element) => element.type))
    );
    expect(elementTypes).toEqual(new Set(Object.values(TSurveyElementTypeEnum)));
  });
});
