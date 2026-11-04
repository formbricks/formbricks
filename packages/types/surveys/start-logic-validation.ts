import type { z } from "zod";
import type { TEmbeddedDataType } from "../embedded-data";
import { RESERVED_FIELD_CATALOG, type TLinkedEmbeddedField } from "../embedded-data-resolver";
import type { TSurveyBlockLogic, TSurveyBlockLogicAction } from "./blocks";
import { getSetValueExpressionIssues } from "./expression-types";
import { type TExpression, isExpressionOverLimits } from "./expressions";
import type { TConditionGroup, TSingleCondition } from "./logic";

/**
 * Validation of the rules before the first question, `survey.startLogic` (ENG-6932, ADR 0023).
 *
 * They use the block-rule format, but run when the survey loads, before the welcome card and before
 * any answer exists:
 *
 * - **Actions** may only jump (to any block, or to an ending, which screens the respondent out) and
 *   set a value (`calculate`). Every other objective, `requireAnswer` and `markLowQuality` included,
 *   is refused at its exact path.
 * - **Conditions and values** may read hidden fields (URL parameters), computed fields and reserved
 *   fields. An `element` operand is refused: there is no answer to read yet.
 *
 * Written apart from the block-logic validator because every one of its messages names a block; the
 * checks that matter here are few, and the path prefix is `startLogic`.
 */

/** What this validator reads off the survey: the fields and destinations rules can name. */
export interface TStartLogicSurvey {
  startLogic?: TSurveyBlockLogic[] | null;
  blocks: readonly { id: string }[];
  endings: readonly { id: string }[];
  variables: readonly { id: string; type: "number" | "text" }[];
  hiddenFields: { fieldIds?: string[] };
  /** The typed fields, when the payload has them: a computed date (ENG-6935) is declared only here. */
  embeddedFields?:
    | readonly (
        | TLinkedEmbeddedField
        | { storageKey?: string; source?: string; dataType?: TEmbeddedDataType }
      )[]
    | null;
}

type TIssue = z.core.$ZodIssue;

const ALLOWED_OBJECTIVES = new Set<string>(["jumpToBlock", "calculate"]);

const ruleLabel = (ruleIdx: number) => `rule ${String(ruleIdx + 1)} before the first question`;

const flattenConditions = (group: TConditionGroup): TSingleCondition[] =>
  group.conditions.flatMap((item) => ("conditions" in item ? flattenConditions(item) : [item]));

const validateConditions = (
  survey: TStartLogicSurvey,
  rule: TSurveyBlockLogic,
  ruleIdx: number
): TIssue[] => {
  const path = ["startLogic", ruleIdx, "conditions"];
  const issues: TIssue[] = [];
  const hiddenFieldIds = survey.hiddenFields.fieldIds ?? [];
  let answerRefused = false;

  const checkOperand = (operand: { type: string; value: unknown } | undefined) => {
    if (!operand) return;
    if (operand.type === "element") {
      // One issue per rule is enough to point at it; the same refusal on every condition is noise.
      if (!answerRefused) {
        answerRefused = true;
        issues.push({
          code: "custom",
          message: `Conditional Logic: ${ruleLabel(ruleIdx)} can't use an answer: nothing has been answered yet. Use a hidden field, a computed field or a reserved field.`,
          path,
        });
      }
    } else if (operand.type === "variable") {
      const variableId = String(operand.value);
      // A computed date (ENG-6935, P38) is declared only in `embeddedFields`, not the legacy list.
      if (
        !survey.variables.some((variable) => variable.id === variableId) &&
        getFieldType(survey, variableId, "computed") === undefined
      ) {
        issues.push({
          code: "custom",
          message: `Conditional Logic: Variable ID ${variableId} does not exist in ${ruleLabel(ruleIdx)}`,
          path,
        });
      }
    } else if (operand.type === "hiddenField") {
      const fieldId = String(operand.value);
      if (!hiddenFieldIds.includes(fieldId) && getFieldType(survey, fieldId, "ingested") === undefined) {
        issues.push({
          code: "custom",
          message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in ${ruleLabel(ruleIdx)}`,
          path,
        });
      }
    }
    // `reserved` names a catalog entry, never checked against the catalog (see the block validator).
  };

  for (const condition of flattenConditions(rule.conditions)) {
    checkOperand(condition.leftOperand);
    checkOperand(condition.rightOperand);
  }
  return issues;
};

/** A field's type by storage key: the typed rows when the payload has them, else the legacy columns. */
const getFieldType = (
  survey: TStartLogicSurvey,
  storageKey: string,
  source: "computed" | "ingested"
): TEmbeddedDataType | undefined => {
  if (survey.embeddedFields) {
    for (const entry of survey.embeddedFields) {
      // The editor and the stored survey hold linked rows; the v3 document holds flat entries.
      const flat =
        "field" in entry
          ? { storageKey: entry.link.storageKey, source: entry.field.source, dataType: entry.field.dataType }
          : entry;
      if (flat.source === source && flat.storageKey === storageKey) return flat.dataType ?? "string";
    }
    return undefined;
  }
  if (source === "ingested") return survey.hiddenFields.fieldIds?.includes(storageKey) ? "string" : undefined;
  const variable = survey.variables.find((item) => item.id === storageKey);
  if (!variable) return undefined;
  return variable.type === "number" ? "number" : "string";
};

/** The first answer a formula reads, as the path to it: nothing has been answered before the first question. */
const findElementLeafPath = (
  node: TExpression,
  path: (string | number)[]
): (string | number)[] | undefined => {
  if (node.type === "element") return [...path, "value"];
  if (node.type !== "call") return undefined;
  for (const [idx, arg] of node.args.entries()) {
    const found = findElementLeafPath(arg, [...path, "args", idx]);
    if (found) return found;
  }
  return undefined;
};

const validateExpressionAction = (
  survey: TStartLogicSurvey,
  variableId: string,
  expression: TExpression,
  ruleIdx: number,
  path: (string | number)[]
): TIssue | undefined => {
  const targetType = getFieldType(survey, variableId, "computed");
  if (!targetType) {
    return {
      code: "custom",
      message: `Conditional Logic: Variable ID ${variableId} does not exist in ${ruleLabel(ruleIdx)}`,
      path: [...path, "variableId"],
    };
  }

  const valuePath = [...path, "value", "value"];
  // Refused by the schema at its path; the walks below would descend the whole hostile tree.
  if (isExpressionOverLimits(expression)) return undefined;
  const answerPath = findElementLeafPath(expression, valuePath);
  if (answerPath) {
    return {
      code: "custom",
      message: `Conditional Logic: ${ruleLabel(ruleIdx)} can't set a value from an answer: nothing has been answered yet.`,
      path: answerPath,
    };
  }

  const issues = getSetValueExpressionIssues(expression, targetType, {
    getElement: () => undefined,
    getComputedFieldType: (storageKey) => getFieldType(survey, storageKey, "computed"),
    getIngestedFieldType: (storageKey) => getFieldType(survey, storageKey, "ingested"),
    getReservedFieldType: (name) => RESERVED_FIELD_CATALOG.find((entry) => entry.name === name)?.dataType,
  });
  if (issues.length === 0) return undefined;
  return { code: "custom", message: issues[0].message, path: [...valuePath, ...issues[0].path] };
};

const validateAction = (
  survey: TStartLogicSurvey,
  action: TSurveyBlockLogicAction,
  ruleIdx: number,
  actionIdx: number
): TIssue | undefined => {
  const path = ["startLogic", ruleIdx, "actions", actionIdx];

  if (action.objective === "markLowQuality") {
    // ENG-6933: there is no response to judge yet. A screener sends the respondent to an ending.
    return {
      code: "custom",
      message: `Conditional Logic: ${ruleLabel(ruleIdx)} can't mark the response Low quality: nothing has been answered yet. Jump to an ending to screen the respondent out instead.`,
      path,
    };
  }

  if (!ALLOWED_OBJECTIVES.has(action.objective)) {
    return {
      code: "custom",
      message: `Conditional Logic: ${ruleLabel(ruleIdx)} can only jump to a block or an ending, or set a value; "${action.objective}" is not allowed before the first question.`,
      path,
    };
  }

  if (action.objective === "jumpToBlock") {
    const exists =
      survey.blocks.some((block) => block.id === action.target) ||
      survey.endings.some((ending) => ending.id === action.target);
    if (exists) return undefined;
    return {
      code: "custom",
      message: `Conditional Logic: Jump destination in ${ruleLabel(ruleIdx)} no longer exists. Choose a valid destination.`,
      path: [...path, "target"],
      params: { missingLogicDestination: "jump" },
    };
  }

  if (action.objective === "calculate") {
    // ENG-6935: a Set value formula, which may set a computed date (declared only in the typed rows).
    if (action.value.type === "expression") {
      return validateExpressionAction(survey, action.variableId, action.value.value, ruleIdx, path);
    }
    const variable = survey.variables.find((item) => item.id === action.variableId);
    if (!variable) {
      return {
        code: "custom",
        message: `Conditional Logic: Variable ID ${action.variableId} does not exist in ${ruleLabel(ruleIdx)}`,
        path: [...path, "variableId"],
      };
    }
    if (action.value.type === "element") {
      return {
        code: "custom",
        message: `Conditional Logic: ${ruleLabel(ruleIdx)} can't set a value from an answer: nothing has been answered yet.`,
        path: [...path, "value"],
      };
    }
    if (action.value.type === "variable") {
      const source = survey.variables.find((item) => item.id === action.value.value);
      if (source?.type !== variable.type) {
        return {
          code: "custom",
          message: `Conditional Logic: Invalid variable type for variable in ${ruleLabel(ruleIdx)}`,
          path: [...path, "value"],
        };
      }
    }
  }

  return undefined;
};

export const validateStartLogic = (survey: TStartLogicSurvey): TIssue[] => {
  const issues: TIssue[] = [];

  (survey.startLogic ?? []).forEach((rule, ruleIdx) => {
    issues.push(...validateConditions(survey, rule, ruleIdx));

    rule.actions.forEach((action, actionIdx) => {
      const issue = validateAction(survey, action, ruleIdx, actionIdx);
      if (issue) issues.push(issue);
    });

    if (rule.actions.filter((action) => action.objective === "jumpToBlock").length > 1) {
      issues.push({
        code: "custom",
        message: `Conditional Logic: Multiple jump actions are not allowed in ${ruleLabel(ruleIdx)}`,
        path: ["startLogic", ruleIdx, "actions"],
      });
    }
  });

  return issues;
};
