import { z } from "zod";
import { ZWorkflowDataRef } from "../common";

/**
 * If/else uses the survey logic operator names (ADR 0046): the subset that makes sense without a
 * survey element behind the value. Each name is a member of `ZSurveyLogicConditionsOperator`
 * (`packages/types/surveys/logic.ts`), and the runner compares with the same function survey logic
 * uses (`compareConditionValues`).
 */
export const WORKFLOW_SURVEY_CONDITION_OPERATORS = [
  "equals",
  "doesNotEqual",
  "contains",
  "doesNotContain",
  "startsWith",
  "doesNotStartWith",
  "endsWith",
  "doesNotEndWith",
  "isGreaterThan",
  "isLessThan",
  "isGreaterThanOrEqual",
  "isLessThanOrEqual",
  "isBefore",
  "isAfter",
  "equalsOneOf",
  "includesAllOf",
  "includesOneOf",
  "doesNotIncludeAllOf",
  "doesNotIncludeOneOf",
  "isSet",
  "isNotSet",
  "isEmpty",
  "isNotEmpty",
] as const;
export const ZWorkflowSurveyConditionOperator = z.enum(WORKFLOW_SURVEY_CONDITION_OPERATORS);
export type TWorkflowSurveyConditionOperator = z.infer<typeof ZWorkflowSurveyConditionOperator>;

/**
 * The operator names the workflow schema shipped with in v1. Deprecated: still accepted, stored and
 * returned as written until v7.0.0 (ADR 0050, ENG-7163), never mixed with the survey names in one
 * definition. Each maps to the survey operator it means.
 */
export const LEGACY_WORKFLOW_CONDITION_OPERATOR_MAP = {
  equals: "equals",
  notEquals: "doesNotEqual",
  lessThan: "isLessThan",
  lessEqual: "isLessThanOrEqual",
  greaterThan: "isGreaterThan",
  greaterEqual: "isGreaterThanOrEqual",
  contains: "contains",
  notContains: "doesNotContain",
  exists: "isSet",
  notExists: "isNotSet",
} as const satisfies Record<string, TWorkflowSurveyConditionOperator>;

export type TWorkflowLegacyConditionOperator = keyof typeof LEGACY_WORKFLOW_CONDITION_OPERATOR_MAP;
export const ZWorkflowLegacyConditionOperator = z.enum(
  Object.keys(LEGACY_WORKFLOW_CONDITION_OPERATOR_MAP) as [
    TWorkflowLegacyConditionOperator,
    ...TWorkflowLegacyConditionOperator[],
  ]
);

const ALL_OPERATORS = [
  ...WORKFLOW_SURVEY_CONDITION_OPERATORS,
  ...(Object.keys(LEGACY_WORKFLOW_CONDITION_OPERATOR_MAP) as TWorkflowLegacyConditionOperator[]).filter(
    (name) => !(WORKFLOW_SURVEY_CONDITION_OPERATORS as readonly string[]).includes(name)
  ),
] as [TWorkflowConditionOperator, ...TWorkflowConditionOperator[]];

export type TWorkflowConditionOperator = TWorkflowSurveyConditionOperator | TWorkflowLegacyConditionOperator;

export const ZWorkflowConditionOperator = z
  .enum(ALL_OPERATORS)
  .describe(
    "Survey logic operator name. The legacy names notEquals, lessThan, lessEqual, greaterThan, greaterEqual, notContains, exists and notExists are deprecated (removed in v7.0.0) and may not be mixed with survey names in one definition."
  );

const LEGACY_ONLY = new Set<string>(
  Object.keys(LEGACY_WORKFLOW_CONDITION_OPERATOR_MAP).filter(
    (name) => !(WORKFLOW_SURVEY_CONDITION_OPERATORS as readonly string[]).includes(name)
  )
);
const SURVEY_ONLY = new Set<string>(
  WORKFLOW_SURVEY_CONDITION_OPERATORS.filter((name) => !(name in LEGACY_WORKFLOW_CONDITION_OPERATOR_MAP))
);

/** Which name set an operator belongs to; `shared` for names both sets use (equals, contains). */
export const getConditionOperatorNameSet = (
  operator: TWorkflowConditionOperator
): "legacy" | "survey" | "shared" => {
  if (LEGACY_ONLY.has(operator)) return "legacy";
  if (SURVEY_ONLY.has(operator)) return "survey";
  return "shared";
};

/** The survey operator an If/else operator means, whichever name set it was written in. */
export const toSurveyConditionOperator = (
  operator: TWorkflowConditionOperator
): TWorkflowSurveyConditionOperator =>
  Object.hasOwn(LEGACY_WORKFLOW_CONDITION_OPERATOR_MAP, operator)
    ? LEGACY_WORKFLOW_CONDITION_OPERATOR_MAP[operator as TWorkflowLegacyConditionOperator]
    : (operator as TWorkflowSurveyConditionOperator);

const PRESENCE_OPERATORS = new Set<TWorkflowSurveyConditionOperator>([
  "isSet",
  "isNotSet",
  "isEmpty",
  "isNotEmpty",
]);
const LIST_OPERATORS = new Set<TWorkflowSurveyConditionOperator>([
  "equalsOneOf",
  "includesAllOf",
  "includesOneOf",
  "doesNotIncludeAllOf",
  "doesNotIncludeOneOf",
]);

/** Most values a list operator compares against; a condition is authored, not a data dump. */
const MAX_CONDITION_LIST_VALUES = 100;
/**
 * Longest text a condition compares against. A single text value is checked on save
 * (`ZWorkflowDefinitionInput`), since stored drafts predate the cap; list values are new and capped here.
 */
export const MAX_CONDITION_TEXT_LENGTH = 1000;

export const ZWorkflowConditionValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(MAX_CONDITION_TEXT_LENGTH)).min(1).max(MAX_CONDITION_LIST_VALUES),
  ZWorkflowDataRef,
]);
export type TWorkflowConditionValue = z.infer<typeof ZWorkflowConditionValue>;

export interface TWorkflowCondition {
  id: string;
  left: z.infer<typeof ZWorkflowDataRef>;
  operator: TWorkflowConditionOperator;
  right?: TWorkflowConditionValue;
}

export interface TWorkflowConditionGroup {
  id: string;
  connector: "and" | "or";
  conditions: (TWorkflowCondition | TWorkflowConditionGroup)[];
}

/**
 * The operator/value rules every comparison follows, an If/else condition or a Switch case: presence
 * operators take no value, every other operator needs one, and only list operators take a list.
 */
export const checkConditionOperands = (
  comparison: { operator: TWorkflowConditionOperator; right?: TWorkflowConditionValue },
  ctx: z.RefinementCtx
): void => {
  const operator = toSurveyConditionOperator(comparison.operator);
  const isPresenceOperator = PRESENCE_OPERATORS.has(operator);

  if (isPresenceOperator && comparison.right !== undefined) {
    ctx.addIssue({
      code: "custom",
      message: `Operator ${comparison.operator} must not have a right-hand value`,
      path: ["right"],
    });
  }

  if (!isPresenceOperator && comparison.right === undefined) {
    ctx.addIssue({
      code: "custom",
      message: `Operator ${comparison.operator} requires a right-hand value`,
      path: ["right"],
    });
  }

  const isList = Array.isArray(comparison.right);
  const isRef = typeof comparison.right === "object" && comparison.right !== null && !isList;
  if (LIST_OPERATORS.has(operator) && comparison.right !== undefined && !isList && !isRef) {
    ctx.addIssue({
      code: "custom",
      message: `Operator ${comparison.operator} compares against a list of values or a Variable`,
      path: ["right"],
    });
  }
  if (!LIST_OPERATORS.has(operator) && isList) {
    ctx.addIssue({
      code: "custom",
      message: `Operator ${comparison.operator} does not take a list of values`,
      path: ["right"],
    });
  }
};

export const ZWorkflowCondition: z.ZodType<TWorkflowCondition> = z
  .object({
    id: z.string().min(1),
    left: ZWorkflowDataRef,
    operator: ZWorkflowConditionOperator,
    right: ZWorkflowConditionValue.optional().describe(
      "Right-hand comparison value: a fixed value, a list of texts for list operators, or a Variable reference. Omit for presence operators."
    ),
  })
  .superRefine(checkConditionOperands);

export const ZWorkflowConditionGroup: z.ZodType<TWorkflowConditionGroup> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    connector: z.enum(["and", "or"]),
    conditions: z.array(z.union([ZWorkflowCondition, ZWorkflowConditionGroup])).min(1),
  })
);

/** Every leaf condition of a group, nested groups included, in order. */
export const flattenWorkflowConditions = (group: TWorkflowConditionGroup): TWorkflowCondition[] =>
  group.conditions.flatMap((condition) =>
    "conditions" in condition ? flattenWorkflowConditions(condition) : [condition]
  );
