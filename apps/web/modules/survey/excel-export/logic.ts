import type { TFunction } from "i18next";
import { type TLinkedEmbeddedField, getSurveyEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import { formatFieldNameToTitleCase } from "@formbricks/types/safe-identifier";
import type {
  TActionCalculate,
  TSurveyBlock,
  TSurveyBlockLogicAction,
} from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type {
  TConditionGroup,
  TDynamicLogicFieldValue,
  TRightOperand,
  TSingleCondition,
  TSurveyLogicConditionsOperator,
} from "@formbricks/types/surveys/logic";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";

/**
 * A block's logic in plain words, for the Excel export's Logic column (ADR 0017): one sentence per rule
 * ("If question nps is less than 7, then jump to question why."), then the fallback ("Otherwise, jump
 * to …"). Written in the exporting user's locale; the values quoted from the survey (choice labels,
 * ending headlines) are its default-language texts, as the editor's logic panel shows them.
 *
 * Questions are named by their id, which the sheet shows in its Question ID column, so a reviewer can
 * find exactly which question a rule means. Anything a rule names that the survey no longer has is
 * shown by its stored id rather than dropped.
 */

type TOperatorPhrase = (operands: { left: string; right: string }) => string;

/** Every condition operator as a phrase. A `Record`, so a new operator is a compile error until it has one. */
const getOperatorPhrases = (t: TFunction): Record<TSurveyLogicConditionsOperator, TOperatorPhrase> => ({
  equals: (o) => t("workspace.surveys.export.logic.equals", o),
  doesNotEqual: (o) => t("workspace.surveys.export.logic.does_not_equal", o),
  contains: (o) => t("workspace.surveys.export.logic.contains", o),
  doesNotContain: (o) => t("workspace.surveys.export.logic.does_not_contain", o),
  startsWith: (o) => t("workspace.surveys.export.logic.starts_with", o),
  doesNotStartWith: (o) => t("workspace.surveys.export.logic.does_not_start_with", o),
  endsWith: (o) => t("workspace.surveys.export.logic.ends_with", o),
  doesNotEndWith: (o) => t("workspace.surveys.export.logic.does_not_end_with", o),
  isSubmitted: (o) => t("workspace.surveys.export.logic.is_submitted", o),
  isSkipped: (o) => t("workspace.surveys.export.logic.is_skipped", o),
  isGreaterThan: (o) => t("workspace.surveys.export.logic.is_greater_than", o),
  isLessThan: (o) => t("workspace.surveys.export.logic.is_less_than", o),
  isGreaterThanOrEqual: (o) => t("workspace.surveys.export.logic.is_greater_than_or_equal", o),
  isLessThanOrEqual: (o) => t("workspace.surveys.export.logic.is_less_than_or_equal", o),
  equalsOneOf: (o) => t("workspace.surveys.export.logic.equals_one_of", o),
  includesAllOf: (o) => t("workspace.surveys.export.logic.includes_all_of", o),
  includesOneOf: (o) => t("workspace.surveys.export.logic.includes_one_of", o),
  doesNotIncludeOneOf: (o) => t("workspace.surveys.export.logic.does_not_include_one_of", o),
  doesNotIncludeAllOf: (o) => t("workspace.surveys.export.logic.does_not_include_all_of", o),
  isClicked: (o) => t("workspace.surveys.export.logic.is_clicked", o),
  isNotClicked: (o) => t("workspace.surveys.export.logic.is_not_clicked", o),
  isAccepted: (o) => t("workspace.surveys.export.logic.is_accepted", o),
  isBefore: (o) => t("workspace.surveys.export.logic.is_before", o),
  isAfter: (o) => t("workspace.surveys.export.logic.is_after", o),
  isBooked: (o) => t("workspace.surveys.export.logic.is_booked", o),
  isPartiallySubmitted: (o) => t("workspace.surveys.export.logic.is_partially_submitted", o),
  isCompletelySubmitted: (o) => t("workspace.surveys.export.logic.is_completely_submitted", o),
  isSet: (o) => t("workspace.surveys.export.logic.is_set", o),
  isNotSet: (o) => t("workspace.surveys.export.logic.is_not_set", o),
  isEmpty: (o) => t("workspace.surveys.export.logic.is_empty", o),
  isNotEmpty: (o) => t("workspace.surveys.export.logic.is_not_empty", o),
  isAnyOf: (o) => t("workspace.surveys.export.logic.is_any_of", o),
});

type TLogicContext = {
  t: TFunction;
  operatorPhrases: Record<TSurveyLogicConditionsOperator, TOperatorPhrase>;
  elements: Map<string, TSurveyElement>;
  blocks: Map<string, TSurveyBlock>;
  endings: TSurvey["endings"];
  embeddedFields: TLinkedEmbeddedField[];
  conjunction: Intl.ListFormat;
};

const plain = (text: string | undefined): string => (text ? getTextContent(text) : "");

const quote = (ctx: TLogicContext, value: string): string =>
  ctx.t("workspace.surveys.export.logic.quoted", { value });

const fieldName = (ctx: TLogicContext, storageKey: string, source: "computed" | "ingested"): string => {
  const linked = ctx.embeddedFields.find(
    ({ field, link }) => link.storageKey === storageKey && field.source === source
  );
  return linked?.field.name.trim() || storageKey;
};

const questionPhrase = (ctx: TLogicContext, elementId: string): string =>
  ctx.t("workspace.surveys.export.logic.question", { id: elementId });

/** A field a condition reads or a calculation uses: a question, a variable, a hidden field or a reserved field. */
const fieldPhrase = (ctx: TLogicContext, operand: TDynamicLogicFieldValue): string => {
  switch (operand.type) {
    case "element": {
      const element = ctx.elements.get(operand.value);
      const rowIndex = operand.meta?.row === undefined ? Number.NaN : Number(operand.meta.row);
      const row = element?.type === TSurveyElementTypeEnum.Matrix ? element.rows[rowIndex] : undefined;
      if (row) {
        return ctx.t("workspace.surveys.export.logic.question_row", {
          id: operand.value,
          row: plain(row.label.default),
        });
      }
      return questionPhrase(ctx, operand.value);
    }
    case "variable":
      return ctx.t("workspace.surveys.export.logic.variable", {
        name: fieldName(ctx, operand.value, "computed"),
      });
    case "hiddenField":
      return ctx.t("workspace.surveys.export.logic.hidden_field", {
        name: fieldName(ctx, operand.value, "ingested"),
      });
    case "reserved":
      return formatFieldNameToTitleCase(operand.value);
  }
};

/**
 * A stored value as its question shows it: a choice by its label, a picture by its position, a matrix
 * column by its label. Anything else, or a choice the question no longer has, as stored.
 */
const staticValueText = (ctx: TLogicContext, value: string, left: TDynamicLogicFieldValue): string => {
  const element = left.type === "element" ? ctx.elements.get(left.value) : undefined;
  switch (element?.type) {
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
    case TSurveyElementTypeEnum.Ranking: {
      const choice = element.choices.find((candidate) => candidate.id === value);
      return choice ? plain(choice.label.default) : value;
    }
    case TSurveyElementTypeEnum.PictureSelection: {
      const index = element.choices.findIndex((candidate) => candidate.id === value);
      return index === -1 ? value : `${ctx.t("common.picture")} ${index + 1}`;
    }
    case TSurveyElementTypeEnum.Matrix: {
      const column = element.columns[Number(value)];
      return column ? plain(column.label.default) : value;
    }
    default:
      return value;
  }
};

const rightOperandPhrase = (ctx: TLogicContext, condition: TSingleCondition): string => {
  const right: TRightOperand | undefined = condition.rightOperand;
  if (!right) return "";
  if (right.type !== "static") return fieldPhrase(ctx, right);

  const { value } = right;
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return quote(ctx, staticValueText(ctx, value, condition.leftOperand));

  // A plain list: the operator's phrase already says whether it means all of the values or one of them.
  return value.map((item) => quote(ctx, staticValueText(ctx, item, condition.leftOperand))).join(", ");
};

const conditionPhrase = (ctx: TLogicContext, condition: TSingleCondition): string =>
  ctx.operatorPhrases[condition.operator]({
    left: fieldPhrase(ctx, condition.leftOperand),
    right: rightOperandPhrase(ctx, condition),
  });

const isConditionGroup = (condition: TSingleCondition | TConditionGroup): condition is TConditionGroup =>
  "connector" in condition;

/** A condition group; a nested group of more than one condition is put in parentheses. */
const groupPhrase = (ctx: TLogicContext, group: TConditionGroup): string => {
  const connector =
    group.connector === "and"
      ? ctx.t("workspace.surveys.export.logic.and")
      : ctx.t("workspace.surveys.export.logic.or");

  return group.conditions
    .map((condition) => {
      if (!isConditionGroup(condition)) return conditionPhrase(ctx, condition);
      const inner = groupPhrase(ctx, condition);
      return condition.conditions.length > 1 ? `(${inner})` : inner;
    })
    .filter((phrase) => phrase !== "")
    .join(` ${connector} `);
};

/** Where a jump lands: a block by its first question, or an ending by its headline. */
const jumpTargetPhrase = (ctx: TLogicContext, targetId: string): string => {
  const block = ctx.blocks.get(targetId);
  if (block) {
    const [firstElement] = block.elements;
    return firstElement
      ? questionPhrase(ctx, firstElement.id)
      : ctx.t("workspace.surveys.export.logic.block", { name: block.name });
  }

  const endingIndex = ctx.endings.findIndex((ending) => ending.id === targetId);
  if (endingIndex !== -1) {
    const ending = ctx.endings[endingIndex];
    const name = ending.type === "endScreen" ? plain(ending.headline?.default) : (ending.label ?? "");
    return name
      ? ctx.t("workspace.surveys.export.logic.ending_named", { name })
      : ctx.t("workspace.surveys.export.logic.ending_n", { n: endingIndex + 1 });
  }

  return targetId;
};

const calculationPhrase = (ctx: TLogicContext, action: TActionCalculate): string => {
  const variable = fieldName(ctx, action.variableId, "computed");
  const value =
    action.value.type === "static"
      ? typeof action.value.value === "number"
        ? String(action.value.value)
        : quote(ctx, action.value.value)
      : fieldPhrase(ctx, action.value);
  const operands = { variable, value };

  switch (action.operator) {
    case "assign":
      return ctx.t("workspace.surveys.export.logic.calculate_assign", operands);
    case "concat":
      return ctx.t("workspace.surveys.export.logic.calculate_concat", operands);
    case "add":
      return ctx.t("workspace.surveys.export.logic.calculate_add", operands);
    case "subtract":
      return ctx.t("workspace.surveys.export.logic.calculate_subtract", operands);
    case "multiply":
      return ctx.t("workspace.surveys.export.logic.calculate_multiply", operands);
    case "divide":
      return ctx.t("workspace.surveys.export.logic.calculate_divide", operands);
  }
};

const actionPhrase = (ctx: TLogicContext, action: TSurveyBlockLogicAction): string => {
  switch (action.objective) {
    case "jumpToBlock":
      return ctx.t("workspace.surveys.export.logic.jump_to", {
        target: jumpTargetPhrase(ctx, action.target),
      });
    case "requireAnswer":
      return ctx.t("workspace.surveys.export.logic.require_answer", {
        question: questionPhrase(ctx, action.target),
      });
    case "calculate":
      return calculationPhrase(ctx, action);
  }
};

/** Reads a survey's logic in plain words; build it once per export, then call it for each block. */
export const createLogicRenderer = ({
  survey,
  t,
  locale,
}: {
  survey: TSurvey;
  t: TFunction;
  locale: string;
}): ((block: TSurveyBlock) => string) => {
  const ctx: TLogicContext = {
    t,
    operatorPhrases: getOperatorPhrases(t),
    elements: new Map(
      survey.blocks.flatMap((block) => block.elements.map((element) => [element.id, element]))
    ),
    blocks: new Map(survey.blocks.map((block) => [block.id, block])),
    endings: survey.endings,
    embeddedFields: getSurveyEmbeddedFields(survey),
    conjunction: new Intl.ListFormat(locale, { type: "conjunction" }),
  };

  return (block) => {
    const lines = (block.logic ?? []).map((rule) => {
      const actions = ctx.conjunction.format(rule.actions.map((action) => actionPhrase(ctx, action)));
      const conditions = groupPhrase(ctx, rule.conditions);
      return conditions
        ? t("workspace.surveys.export.logic.rule", { conditions, actions })
        : t("workspace.surveys.export.logic.rule_always", { actions });
    });

    if (block.logicFallback) {
      lines.push(
        t("workspace.surveys.export.logic.fallback", { target: jumpTargetPhrase(ctx, block.logicFallback) })
      );
    }

    return lines.join("\n");
  };
};
