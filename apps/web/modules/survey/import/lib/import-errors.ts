import type { TV3InvalidParam, V3ApiError } from "@/modules/api/lib/v3-client";
import { getAiErrorMessage } from "@/modules/survey/components/template-list/lib/ai-error-messages";

type TTranslate = (key: string, options?: Record<string, unknown>) => string;

/** The dialog's code for a Qualtrics export past one of the import's limits: this prefix, then the limit's name. */
export const QSF_IMPORT_LIMIT_CODE_PREFIX = "qsf_limit_exceeded:";

/**
 * Which limit a file is past, by the name the route sends (`TSurveyImportLimit`); an unknown one
 * generically.
 */
const getImportLimitMessage = (limit: string, t: TTranslate): string => {
  switch (limit) {
    case "questions":
      return t("workspace.surveys.import.errors.limits.questions");
    case "options":
      return t("workspace.surveys.import.errors.limits.options");
    case "languages":
      return t("workspace.surveys.import.errors.limits.languages");
    case "language_keys":
      return t("workspace.surveys.import.errors.limits.language_keys");
    case "blocks":
      return t("workspace.surveys.import.errors.limits.blocks");
    case "block_entries":
      return t("workspace.surveys.import.errors.limits.block_entries");
    case "flow_nodes":
      return t("workspace.surveys.import.errors.limits.flow_nodes");
    case "flow_depth":
      return t("workspace.surveys.import.errors.limits.flow_depth");
    case "embedded_data":
      return t("workspace.surveys.import.errors.limits.embedded_data");
    case "texts":
      return t("workspace.surveys.import.errors.limits.texts");
    case "formatted_texts":
      return t("workspace.surveys.import.errors.limits.formatted_texts");
    case "prompt_size":
      return t("workspace.surveys.import.errors.limits.prompt_size");
    default:
      return t("workspace.surveys.import.errors.limits.other");
  }
};

/** The dialog's code for a document past one of the import's limits: this prefix, then the limit. */
export const SURVEY_IMPORT_DOCUMENT_LIMIT_CODE_PREFIX = "document_limit_exceeded:";

/**
 * The dialog's code for a JSON file that does not parse: this, then `:line:column` when the route said
 * where it stops (the problem's `details`).
 */
export const SURVEY_IMPORT_JSON_INVALID_CODE = "json_invalid";

const isPositiveInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;

/** `json_invalid:3:26` from the refusal's `details`, or `json_invalid` when they say nothing usable. */
const jsonInvalidCode = (details: unknown): string => {
  const { line, column } = (details ?? {}) as { line?: unknown; column?: unknown };
  return isPositiveInteger(line) && isPositiveInteger(column)
    ? `${SURVEY_IMPORT_JSON_INVALID_CODE}:${line}:${column}`
    : SURVEY_IMPORT_JSON_INVALID_CODE;
};

/** The sentence for `json_invalid[:line:column]`. */
const getJsonInvalidMessage = (code: string, t: TTranslate): string => {
  const [line, column] = code
    .slice(SURVEY_IMPORT_JSON_INVALID_CODE.length + 1)
    .split(":")
    .map(Number);
  return isPositiveInteger(line) && isPositiveInteger(column)
    ? t("workspace.surveys.import.errors.invalid_json_at", { line, column })
    : t("workspace.surveys.import.errors.invalid_json");
};

/** Which limit a document is past (`TSurveyImportDocumentLimit`); an unknown one generically. */
const getDocumentLimitMessage = (limit: string, t: TTranslate): string => {
  switch (limit) {
    case "rows":
      return t("workspace.surveys.import.errors.document_limits.rows");
    case "columns":
      return t("workspace.surveys.import.errors.document_limits.columns");
    case "cell_size":
      return t("workspace.surveys.import.errors.document_limits.cell_size");
    case "xml_depth":
      return t("workspace.surveys.import.errors.document_limits.xml_depth");
    // Too many attributes is too much content to the user, as too many elements is.
    case "xml_elements":
    case "xml_attributes":
      return t("workspace.surveys.import.errors.document_limits.xml_elements");
    case "paragraphs":
      return t("workspace.surveys.import.errors.document_limits.paragraphs");
    case "tables":
      return t("workspace.surveys.import.errors.document_limits.tables");
    case "table_cells":
      return t("workspace.surveys.import.errors.document_limits.table_cells");
    case "source_size":
      return t("workspace.surveys.import.errors.document_limits.source_size");
    case "text_size":
      return t("workspace.surveys.import.errors.document_limits.text_size");
    default:
      return t("workspace.surveys.import.errors.document_limits.other");
  }
};

/**
 * What is wrong with one field a refusal names, in the user's language, by the code the server gave
 * it; a field without a known code is "not valid". The dialog shows it above the field's path, with the
 * server's reason verbatim underneath as the technical detail a user can paste to an AI assistant.
 */
export const getSurveyImportFieldProblemHeadline = (code: TV3InvalidParam["code"], t: TTranslate): string => {
  switch (code) {
    case "missing_required_field":
      return t("workspace.surveys.import.errors.field_problems.missing_required_field");
    case "unsupported_field":
      return t("workspace.surveys.import.errors.field_problems.unsupported_field");
    case "dangling_reference":
      return t("workspace.surveys.import.errors.field_problems.dangling_reference");
    case "invalid_reference":
      return t("workspace.surveys.import.errors.field_problems.invalid_reference");
    case "misordered_reference":
      return t("workspace.surveys.import.errors.field_problems.misordered_reference");
    case "immutable_identifier":
      return t("workspace.surveys.import.errors.field_problems.immutable_identifier");
    case "read_only_field":
      return t("workspace.surveys.import.errors.field_problems.read_only_field");
    case "duplicate_identifier":
      return t("workspace.surveys.import.errors.field_problems.duplicate_identifier");
    case "forbidden_identifier":
      return t("workspace.surveys.import.errors.field_problems.forbidden_identifier");
    case "missing_translation":
      return t("workspace.surveys.import.errors.field_problems.missing_translation");
    case "invalid_locale":
    case "unsupported_locale":
      return t("workspace.surveys.import.errors.field_problems.invalid_locale");
    case "duplicate_locale":
      return t("workspace.surveys.import.errors.field_problems.duplicate_locale");
    case "limit_exceeded":
      return t("workspace.surveys.import.errors.field_problems.limit_exceeded");
    default:
      return t("workspace.surveys.import.errors.field_problems.invalid");
  }
};

const hasParamIdentifier = (error: V3ApiError, identifier: string): boolean =>
  error.invalid_params?.some((param) => param.identifier === identifier) ?? false;

/**
 * The dialog's code for a 422: a Formbricks file's own problem code, or what the route's refusal of the
 * file names in its `invalid_params`.
 */
const getUnprocessableFileCode = (error: V3ApiError): string => {
  const hasParam = (code: string) => error.invalid_params?.some((param) => param.code === code) ?? false;
  if (error.code === "formbricks_file_invalid" || error.code === "formbricks_file_too_new") {
    return error.code;
  }
  // A file past the JSON budget is too complex; a broken one unreadable. A Qualtrics export past
  // one of the import's limits names the limit, and one the reader does not recognise says so.
  if (hasParam("file_limit_exceeded")) return "file_too_complex";
  // A JSON file that does not parse was most likely edited, so it says where, rather than "export
  // it again", which would throw the edits away.
  if (hasParamIdentifier(error, "json_syntax")) return jsonInvalidCode(error.details);
  if (hasParam("file_unreadable")) return "file_unreadable";
  // A question list past the sheet's limits, or the AI's, names the limit.
  const documentLimit = error.invalid_params?.find(
    (param) => param.code === "document_limit_exceeded"
  )?.identifier;
  if (documentLimit) return `${SURVEY_IMPORT_DOCUMENT_LIMIT_CODE_PREFIX}${documentLimit}`;
  const limit = error.invalid_params?.find((param) => param.code === "qsf_limit_exceeded")?.identifier;
  if (limit) return `${QSF_IMPORT_LIMIT_CODE_PREFIX}${limit}`;
  if (hasParam("qsf_not_recognized")) return "qsf_not_recognized";
  // An import into a survey's own menu (ENG-6809) reads a workbook only as that survey's Excel export.
  if (hasParam("excel_export_not_recognized")) return "excel_export_not_recognized";
  if (hasParam("excel_export_other_survey")) return "excel_export_other_survey";
  // Any other 422 may come from any lane, so it gets the sentence that fits every file.
  return "file_unreadable";
};

/**
 * The dialog's code for a request the route refused before streaming. The route codes each refusal of
 * the file in its `invalid_params` (`TSurveyImportRefusalCode`), which splits the 422s; a 400 is a body
 * the dialog sent wrong.
 *
 * A 415 is a kind of file the import does not read; a Formbricks file's own 422s carry their problem
 * code, which says whether to fix the file or to update Formbricks (ENG-6850).
 */
export const getSurveyImportRequestErrorCode = (error: V3ApiError): string => {
  switch (error.status) {
    case 400:
      return "file_unreadable";
    case 401:
      return "not_authenticated";
    case 413:
      return hasParamIdentifier(error, "survey_size") ? "survey_too_large" : "file_too_large";
    case 415:
      return "file_type_unsupported";
    case 422:
      return getUnprocessableFileCode(error);
    default:
      return error.code ?? "ai_unknown";
  }
};

/**
 * The sentences for an import into a survey from its menu (ENG-6809): a file of another kind, a workbook
 * that is not an Excel export, or another survey's. Literal `t()` calls, so the translation scanner sees
 * every key.
 */
const INTO_SURVEY_MESSAGES: Readonly<Record<string, (t: TTranslate) => string>> = {
  file_wrong_extension_into_survey: (t) => t("workspace.surveys.import.errors.wrong_extension_into_survey"),
  excel_export_not_recognized: (t) => t("workspace.surveys.import.errors.excel_export_not_recognized"),
  excel_export_other_survey: (t) => t("workspace.surveys.import.errors.excel_export_other_survey"),
};

/**
 * The sentence for an import failure: a file the browser refused, a request the route refused, or an
 * `error` event from the stream. AI codes fall through to Create with AI's wording, so both features
 * say the same thing about the same provider problem.
 */
export const getSurveyImportErrorMessage = (
  code: string,
  t: TTranslate,
  retryAfterSeconds: number | null = null
): string => {
  if (code.startsWith(QSF_IMPORT_LIMIT_CODE_PREFIX)) {
    return getImportLimitMessage(code.slice(QSF_IMPORT_LIMIT_CODE_PREFIX.length), t);
  }
  if (code.startsWith(SURVEY_IMPORT_DOCUMENT_LIMIT_CODE_PREFIX)) {
    return getDocumentLimitMessage(code.slice(SURVEY_IMPORT_DOCUMENT_LIMIT_CODE_PREFIX.length), t);
  }
  if (code === SURVEY_IMPORT_JSON_INVALID_CODE || code.startsWith(`${SURVEY_IMPORT_JSON_INVALID_CODE}:`)) {
    return getJsonInvalidMessage(code, t);
  }
  if (Object.hasOwn(INTO_SURVEY_MESSAGES, code)) return INTO_SURVEY_MESSAGES[code](t);

  switch (code) {
    case "file_wrong_extension":
      return t("workspace.surveys.import.errors.wrong_extension");
    case "file_needs_ai":
      return t("workspace.surveys.import.errors.needs_ai");
    case "file_type_unsupported":
      return t("workspace.surveys.import.errors.file_type_unsupported");
    case "survey_too_large":
      return t("workspace.surveys.import.errors.survey_too_large");
    case "formbricks_file_invalid":
      return t("workspace.surveys.import.errors.formbricks_file_invalid");
    case "formbricks_file_too_new":
      return t("workspace.surveys.import.errors.formbricks_file_too_new");
    case "idempotency_key_in_use":
      return t("workspace.surveys.import.errors.still_creating");
    case "survey_active":
      return t("workspace.surveys.import.errors.survey_active");
    case "survey_changed_again":
      return t("workspace.surveys.import.errors.survey_changed_again");
    case "file_empty":
      return t("workspace.surveys.import.errors.empty_file");
    case "file_too_large":
      return t("workspace.surveys.import.errors.file_too_large");
    case "qsf_not_recognized":
      return t("workspace.surveys.import.errors.not_a_qsf");
    case "file_too_complex":
      return t("workspace.surveys.import.errors.too_complex");
    case "file_unreadable":
      return t("workspace.surveys.import.errors.unreadable");
    case "not_authenticated":
      return t("workspace.surveys.import.errors.session_expired");
    case "forbidden":
      return t("workspace.surveys.import.errors.not_allowed");
    case "concurrency_limit_reached":
      return t("workspace.surveys.import.errors.already_importing");
    case "capacity_reached":
      return t("workspace.surveys.import.errors.busy");
    case "import_timed_out":
      return t("workspace.surveys.import.errors.timed_out");
    case "import_failed":
      return t("workspace.surveys.import.errors.failed");
    case "import_too_large":
      return t("workspace.surveys.import.errors.too_many_questions");
    case "import_partly_unread":
      return t("workspace.surveys.import.errors.partly_unread");
    case "import_nothing_importable":
      return t("workspace.surveys.import.errors.nothing_importable");
    case "import_too_large_for_ai":
      return t("workspace.surveys.import.errors.too_large_for_ai");
    case "import_no_questions":
      return t("workspace.surveys.import.errors.no_questions");
    case "too_many_requests":
      return retryAfterSeconds === null
        ? getAiErrorMessage(code, t)
        : t("workspace.surveys.import.errors.rate_limited", { seconds: retryAfterSeconds });
    case "ai_quota_exceeded":
      return retryAfterSeconds === null
        ? getAiErrorMessage(code, t)
        : t("workspace.surveys.import.errors.ai_busy", { seconds: retryAfterSeconds });
    // Create with AI's lines for these talk about a prompt; an import has a file.
    case "ai_output_too_long":
      return t("workspace.surveys.import.errors.too_complex");
    case "bad_request":
      return t("workspace.surveys.import.errors.failed");
    default:
      return getAiErrorMessage(code, t);
  }
};
