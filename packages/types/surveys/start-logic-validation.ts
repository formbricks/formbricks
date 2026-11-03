import type { z } from "zod";
import type { TSurveyBlockLogic, TSurveyBlockLogicAction } from "./blocks";
import type { TConditionGroup, TSingleCondition } from "./logic";

/**
 * Validation of the rules before the first question, `survey.startLogic` (ENG-6932, ADR 0023).
 *
 * They use the block-rule format, but run when the survey loads, before the welcome card and before
 * any answer exists:
 *
 * - **Actions** may only jump (to any block, or to an ending, which screens the respondent out) and
 *   set a value (`calculate`). Every other objective is refused at its exact path.
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
      if (!survey.variables.some((variable) => variable.id === variableId)) {
        issues.push({
          code: "custom",
          message: `Conditional Logic: Variable ID ${variableId} does not exist in ${ruleLabel(ruleIdx)}`,
          path,
        });
      }
    } else if (operand.type === "hiddenField") {
      const fieldId = String(operand.value);
      if (!hiddenFieldIds.includes(fieldId)) {
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

const validateAction = (
  survey: TStartLogicSurvey,
  action: TSurveyBlockLogicAction,
  ruleIdx: number,
  actionIdx: number
): TIssue | undefined => {
  const path = ["startLogic", ruleIdx, "actions", actionIdx];

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
