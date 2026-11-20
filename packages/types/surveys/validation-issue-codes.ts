/**
 * Semantic codes for the survey schema's own validation issues (ENG-629).
 *
 * The schema's `message` stays English: the API returns it, and `packages/types` has no `t()`. Each
 * issue the editor can show also carries `params.issueCode` plus the values its message needs, and
 * the editor maps the code to a translated message at the UI boundary, where its `t()` keys are
 * literal and scannable. A code names what is wrong, never where: the issue path says where.
 */
export const SURVEY_VALIDATION_ISSUE_CODES = [
  // A rule condition's right operand
  "right_operand_required",
  "right_operand_empty",
  "right_operand_not_allowed",
  "right_operand_must_be_static",
  "right_operand_must_be_static_or_field",
  "right_operand_must_be_text",
  "right_operand_must_be_list",
  "right_operand_must_be_number",
  "static_value_required",
  "date_value_required",
  "date_value_invalid",
  "nps_value_out_of_range",
  "rating_value_out_of_range",
  "choice_not_found",
  "selected_choices_not_found",
  "right_operand_question_type_invalid",
  // What a condition refers to
  "question_not_found",
  "question_in_later_block",
  "field_not_found",
  "field_type_mismatch",
  "operator_invalid_for_question_type",
  "cta_without_external_button",
  "matrix_operator_not_allowed",
  "matrix_row_invalid",
  "matrix_row_not_found",
  "matrix_column_not_found",
  // Show-if references
  "show_if_uses_itself",
  "show_if_uses_later_question",
  // Rule actions
  "set_value_field_not_found",
  "set_value_date_needs_expression",
  "set_value_type_mismatch",
  "set_value_question_type_invalid",
  "require_answer_question_not_found",
  "require_answer_same_block",
  "require_answer_earlier_block",
  "require_answer_already_required",
  "jump_to_own_block",
  "multiple_jumps",
  // Fallback and block flow
  "fallback_without_rules",
  "fallback_to_own_block",
  "cyclic_logic",
  // Questions
  "file_upload_no_extensions",
  "cal_host_invalid",
  "subfields_all_hidden",
  "button_url_required",
  "button_url_invalid",
  // Endings
  "ending_button_label_required",
  "ending_button_link_required",
  "ending_button_link_invalid",
  "redirect_label_required",
  "redirect_url_required",
  "redirect_url_invalid",
  // Follow-ups
  "follow_up_invalid_recipient",
  "follow_up_no_ending",
] as const;

export type TSurveyValidationIssueCode = (typeof SURVEY_VALIDATION_ISSUE_CODES)[number];

export type TSurveyValidationIssueParams = {
  issueCode: TSurveyValidationIssueCode;
} & Record<string, unknown>;

/** The `params` of a coded issue: its code and the values its message is built from. */
export const issueParams = (
  issueCode: TSurveyValidationIssueCode,
  values: Record<string, unknown> = {}
): TSurveyValidationIssueParams => ({ ...values, issueCode });

const ISSUE_CODE_SET = new Set<string>(SURVEY_VALIDATION_ISSUE_CODES);

/** The code and values of a coded issue, or `undefined` for any other issue. */
export const getSurveyValidationIssueParams = (issue: {
  code: string;
  params?: unknown;
}): TSurveyValidationIssueParams | undefined => {
  if (issue.code !== "custom" || typeof issue.params !== "object" || issue.params === null) return undefined;
  const { issueCode } = issue.params as { issueCode?: unknown };
  if (typeof issueCode !== "string" || !ISSUE_CODE_SET.has(issueCode)) return undefined;
  return issue.params as TSurveyValidationIssueParams;
};
