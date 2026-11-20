import { TFunction } from "i18next";
import type { z } from "zod";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import {
  type TSurveyValidationIssueParams,
  getSurveyValidationIssueParams,
} from "@formbricks/types/surveys/validation-issue-codes";
import { getLogicRules } from "@/modules/survey/editor/lib/logic-rule-engine";
import { getTSurveyElementTypeEnumName } from "@/modules/survey/lib/elements";

type TIssue = Pick<z.core.$ZodIssue, "code" | "path"> & { params?: unknown };

/** A label from the rule engine is a word ("Equals") or a symbol ("="); a word reads better in a sentence. */
const isSymbolLabel = (label: string): boolean => !/[\p{L}]/u.test(label);

/** Every condition operator the rule builder offers, by value, in the words the builder shows. */
const getOperatorLabels = (t: TFunction): Map<string, string> => {
  const labels = new Map<string, string>();
  const collect = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const { label, value } = node as { label?: unknown; value?: unknown };
    if (typeof label === "string" && typeof value === "string") {
      const known = labels.get(value);
      if (!known || (isSymbolLabel(known) && !isSymbolLabel(label))) labels.set(value, label);
      return;
    }
    Object.values(node).forEach(collect);
  };
  collect(getLogicRules(t));
  return labels;
};

const getStringParam = (params: TSurveyValidationIssueParams, key: string): string =>
  typeof params[key] === "string" ? params[key] : "";

const getNumberParam = (params: TSurveyValidationIssueParams, key: string): number | undefined =>
  typeof params[key] === "number" ? params[key] : undefined;

/**
 * What is wrong, translated. Literal `t()` calls, one per code, so the translation scanner sees
 * every key; the location is added by `getIssueLocation`.
 */
const getIssueMessage = (params: TSurveyValidationIssueParams, t: TFunction): string => {
  const rawOperator = getStringParam(params, "operator");
  const operator = rawOperator ? (getOperatorLabels(t).get(rawOperator) ?? rawOperator) : "";
  const rawQuestionType = getStringParam(params, "questionType");
  const questionType = getTSurveyElementTypeEnumName(rawQuestionType, t) ?? rawQuestionType;

  switch (params.issueCode) {
    case "right_operand_required":
      return t("workspace.surveys.edit.validation_issue.right_operand_required", { operator });
    case "right_operand_empty":
      return t("workspace.surveys.edit.validation_issue.right_operand_empty", { operator });
    case "right_operand_not_allowed":
      return t("workspace.surveys.edit.validation_issue.right_operand_not_allowed", { operator });
    case "right_operand_must_be_static":
      return t("workspace.surveys.edit.validation_issue.right_operand_must_be_static", { operator });
    case "right_operand_must_be_static_or_field":
      return t("workspace.surveys.edit.validation_issue.right_operand_must_be_static_or_field", {
        operator,
      });
    case "right_operand_must_be_text":
      return t("workspace.surveys.edit.validation_issue.right_operand_must_be_text", { operator });
    case "right_operand_must_be_list":
      return t("workspace.surveys.edit.validation_issue.right_operand_must_be_list", { operator });
    case "right_operand_must_be_number":
      return t("workspace.surveys.edit.validation_issue.right_operand_must_be_number", { operator });
    case "static_value_required":
      return t("workspace.surveys.edit.validation_issue.static_value_required");
    case "date_value_required":
      return t("workspace.surveys.edit.validation_issue.date_value_required");
    case "date_value_invalid":
      return t("workspace.surveys.edit.validation_issue.date_value_invalid");
    case "nps_value_out_of_range":
      return t("workspace.surveys.edit.validation_issue.nps_value_out_of_range");
    case "rating_value_out_of_range":
      return t("workspace.surveys.edit.validation_issue.rating_value_out_of_range", {
        max: getNumberParam(params, "max"),
      });
    case "choice_not_found":
      return t("workspace.surveys.edit.validation_issue.choice_not_found");
    case "selected_choices_not_found":
      return t("workspace.surveys.edit.validation_issue.selected_choices_not_found");
    case "right_operand_question_type_invalid":
      return t("workspace.surveys.edit.validation_issue.right_operand_question_type_invalid", {
        questionType,
      });
    case "question_not_found":
      return t("workspace.surveys.edit.validation_issue.question_not_found");
    case "question_in_later_block":
      return t("workspace.surveys.edit.validation_issue.question_in_later_block", {
        blockNumber: getNumberParam(params, "blockNumber"),
      });
    case "field_not_found":
      return t("workspace.surveys.edit.validation_issue.field_not_found");
    case "field_type_mismatch":
      return params.expectedType === "number"
        ? t("workspace.surveys.edit.validation_issue.field_must_be_number")
        : t("workspace.surveys.edit.validation_issue.field_must_be_text");
    case "operator_invalid_for_question_type":
      return t("workspace.surveys.edit.validation_issue.operator_invalid_for_question_type", {
        operator,
        questionType,
      });
    case "cta_without_external_button":
      return t("workspace.surveys.edit.validation_issue.cta_without_external_button");
    case "matrix_operator_not_allowed":
      return t("workspace.surveys.edit.validation_issue.matrix_operator_not_allowed", { operator });
    case "matrix_row_invalid":
    case "matrix_row_not_found":
      return t("workspace.surveys.edit.validation_issue.matrix_row_not_found");
    case "matrix_column_not_found":
      return t("workspace.surveys.edit.validation_issue.matrix_column_not_found");
    case "show_if_uses_itself":
      return t("workspace.surveys.edit.validation_issue.show_if_uses_itself");
    case "show_if_uses_later_question":
      return t("workspace.surveys.edit.validation_issue.show_if_uses_later_question");
    case "set_value_field_not_found":
      return t("workspace.surveys.edit.validation_issue.set_value_field_not_found");
    case "set_value_date_needs_expression":
      return t("workspace.surveys.edit.validation_issue.set_value_date_needs_expression");
    case "set_value_type_mismatch":
      return t("workspace.surveys.edit.validation_issue.set_value_type_mismatch");
    case "set_value_question_type_invalid":
      return t("workspace.surveys.edit.validation_issue.set_value_question_type_invalid");
    case "require_answer_question_not_found":
      return t("workspace.surveys.edit.validation_issue.require_answer_question_not_found");
    case "require_answer_same_block":
      return t("workspace.surveys.edit.validation_issue.require_answer_same_block");
    case "require_answer_earlier_block":
      return t("workspace.surveys.edit.validation_issue.require_answer_earlier_block");
    case "require_answer_already_required":
      return t("workspace.surveys.edit.validation_issue.require_answer_already_required");
    case "jump_to_own_block":
      return t("workspace.surveys.edit.validation_issue.jump_to_own_block");
    case "multiple_jumps":
      return t("workspace.surveys.edit.validation_issue.multiple_jumps");
    case "fallback_without_rules":
      return t("workspace.surveys.edit.validation_issue.fallback_without_rules");
    case "fallback_to_own_block":
      return t("workspace.surveys.edit.validation_issue.fallback_to_own_block");
    case "cyclic_logic":
      return t("workspace.surveys.edit.validation_issue.cyclic_logic");
    case "file_upload_no_extensions":
      return t("workspace.surveys.edit.validation_issue.file_upload_no_extensions");
    case "cal_host_invalid":
      return t("workspace.surveys.edit.validation_issue.cal_host_invalid");
    case "subfields_all_hidden":
      return t("workspace.surveys.edit.validation_issue.subfields_all_hidden");
    case "button_url_required":
      return t("workspace.surveys.edit.validation_issue.button_url_required");
    case "button_url_invalid":
      return t("workspace.surveys.edit.validation_issue.button_url_invalid");
    case "ending_button_label_required":
      return t("workspace.surveys.edit.validation_issue.ending_button_label_required");
    case "ending_button_link_required":
      return t("workspace.surveys.edit.validation_issue.ending_button_link_required");
    case "ending_button_link_invalid":
      return t("workspace.surveys.edit.validation_issue.ending_button_link_invalid");
    case "redirect_label_required":
      return t("workspace.surveys.edit.validation_issue.redirect_label_required");
    case "redirect_url_required":
      return t("workspace.surveys.edit.validation_issue.redirect_url_required");
    case "redirect_url_invalid":
      return t("workspace.surveys.edit.validation_issue.redirect_url_invalid");
    case "follow_up_invalid_recipient":
      return t("workspace.surveys.edit.validation_issue.follow_up_invalid_recipient");
    case "follow_up_no_ending":
      return t("workspace.surveys.edit.validation_issue.follow_up_no_ending");
  }
};

/** Where a question's issue is: its show-if, one option's show-if, or the question itself. */
const getQuestionLocation = (
  questionNumber: number,
  blockName: string,
  [field, optionIndex, optionField]: readonly PropertyKey[],
  t: TFunction
): string => {
  if (field === "showIf") {
    return t("workspace.surveys.edit.validation_issue.location_question_show_if", {
      questionNumber,
      blockName,
    });
  }
  if (typeof optionIndex === "number" && optionField === "showIf") {
    return t("workspace.surveys.edit.validation_issue.location_option_show_if", {
      optionNumber: optionIndex + 1,
      questionNumber,
      blockName,
    });
  }
  return t("workspace.surveys.edit.validation_issue.location_question", { questionNumber, blockName });
};

/** Where a block's issue is: one of its rules, its show-if, one of its questions, or the block itself. */
const getBlockLocation = (
  blockIndex: number,
  [section, sectionIndex, ...rest]: readonly PropertyKey[],
  params: TSurveyValidationIssueParams,
  blocks: readonly TSurveyBlock[],
  t: TFunction
): string => {
  // Named like the logic-destination messages: the block's title, or its position when blank.
  const blockName =
    blocks[blockIndex]?.name?.trim() || t("workspace.surveys.edit.block_n", { blockNumber: blockIndex + 1 });

  if (section === "logic") {
    const ruleNumber =
      typeof sectionIndex === "number" ? sectionIndex + 1 : getNumberParam(params, "ruleNumber");
    return ruleNumber
      ? t("workspace.surveys.edit.validation_issue.location_rule", { ruleNumber, blockName })
      : blockName;
  }
  if (section === "showIf") {
    return t("workspace.surveys.edit.validation_issue.location_block_show_if", { blockName });
  }
  if (section === "elements" && typeof sectionIndex === "number") {
    return getQuestionLocation(sectionIndex + 1, blockName, rest, t);
  }
  return blockName;
};

/** Where the issue is, from its path: the rule, show-if, question, ending or follow-up it belongs to. */
const getIssueLocation = (
  path: readonly PropertyKey[],
  params: TSurveyValidationIssueParams,
  blocks: readonly TSurveyBlock[],
  t: TFunction
): string | null => {
  const [root, index, ...rest] = path;

  if (root === "endings" && typeof index === "number") {
    return t("workspace.surveys.edit.validation_issue.location_ending", { endingNumber: index + 1 });
  }
  if (root === "followUps") {
    const followUpNumber = getNumberParam(params, "followUpNumber");
    return followUpNumber
      ? t("workspace.surveys.edit.validation_issue.location_follow_up", { followUpNumber })
      : null;
  }
  if (root === "blocks" && typeof index === "number") {
    return getBlockLocation(index, rest, params, blocks, t);
  }
  return null;
};

/**
 * The translated message for a survey schema issue that carries a semantic code (ENG-629), or `null`
 * when it carries none and the caller has to fall back to the schema's English message.
 */
export const describeSurveyValidationIssue = (
  issue: TIssue,
  blocks: readonly TSurveyBlock[],
  t: TFunction
): string | null => {
  const params = getSurveyValidationIssueParams(issue);
  if (!params) return null;

  const message = getIssueMessage(params, t);
  const location = getIssueLocation(issue.path, params, blocks, t);
  return location
    ? t("workspace.surveys.edit.validation_issue.with_location", { location, message })
    : message;
};
