import type { V3ApiError } from "@/modules/api/lib/v3-client";
import { getAiErrorMessage } from "@/modules/survey/components/template-list/lib/ai-error-messages";

type TTranslate = (key: string, options?: Record<string, unknown>) => string;

/** The dialog's code for a file past one of the import's limits: this prefix, then the limit's name. */
export const SURVEY_IMPORT_LIMIT_CODE_PREFIX = "qsf_limit_exceeded:";

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

const hasParamIdentifier = (error: V3ApiError, identifier: string): boolean =>
  error.invalid_params?.some((param) => param.identifier === identifier) ?? false;

/**
 * The dialog's code for a request the route refused before streaming. The route codes each refusal of
 * the file in its `invalid_params` (`TSurveyImportRefusalCode`), which splits the 422s; a 400 is a body
 * the dialog sent wrong.
 *
 * A 415 is a kind of file the import does not read; a Formbricks file's own 422s carry their problem
 * code, which says whether to fix the file or to update Formbricks (ENG-6850).
 */
export const getSurveyImportRequestErrorCode = (error: V3ApiError): string => {
  const hasParam = (code: string) => error.invalid_params?.some((param) => param.code === code) ?? false;

  switch (error.status) {
    case 400:
      return "file_unreadable";
    case 401:
      return "not_authenticated";
    case 413:
      return hasParamIdentifier(error, "survey_size") ? "survey_too_large" : "file_too_large";
    case 415:
      return "file_type_unsupported";
    case 422: {
      if (error.code === "formbricks_file_invalid" || error.code === "formbricks_file_too_new") {
        return error.code;
      }
      // A file past the JSON budget is too complex; a broken one unreadable. A Qualtrics export past
      // one of the import's limits names the limit; any other 422 is a file the import cannot read as a
      // Qualtrics export.
      if (hasParam("file_limit_exceeded")) return "file_too_complex";
      if (hasParam("file_unreadable")) return "file_unreadable";
      const limit = error.invalid_params?.find((param) => param.code === "qsf_limit_exceeded")?.identifier;
      return limit ? `${SURVEY_IMPORT_LIMIT_CODE_PREFIX}${limit}` : "qsf_not_recognized";
    }
    default:
      return error.code ?? "ai_unknown";
  }
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
  if (code.startsWith(SURVEY_IMPORT_LIMIT_CODE_PREFIX)) {
    return getImportLimitMessage(code.slice(SURVEY_IMPORT_LIMIT_CODE_PREFIX.length), t);
  }

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
