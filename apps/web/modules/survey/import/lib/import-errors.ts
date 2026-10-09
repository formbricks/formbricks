import type { V3ApiError } from "@/modules/api/lib/v3-client";
import { getAiErrorMessage } from "@/modules/survey/components/template-list/lib/ai-error-messages";

type TTranslate = (key: string, options?: Record<string, unknown>) => string;

/** The dialog's code for a file past one of the import's limits: this prefix, then the limit's name. */
export const QSF_LIMIT_CODE_PREFIX = "qsf_limit_exceeded:";

/** Which limit a file is past, by the name the route sends (`TQsfImportLimit`); an unknown one generically. */
const getQsfLimitMessage = (limit: string, t: TTranslate): string => {
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

/**
 * The dialog's code for a request the route refused before streaming. The 400s are split by what the
 * `invalid_params` name: a path under `qsf.` is the file outgrowing the request budget (too many items
 * in an array, or nested too deep); anything else is a body the dialog sent wrong.
 */
export const getQsfImportRequestErrorCode = (error: V3ApiError): string => {
  switch (error.status) {
    case 400:
      return error.invalid_params?.some((param) => param.name.startsWith("qsf."))
        ? "qsf_too_complex"
        : "qsf_unreadable";
    case 401:
      return "not_authenticated";
    case 413:
      return "qsf_too_large";
    case 422: {
      // A Qualtrics export past one of the import's limits names the limit; any other 422 is a file
      // the import cannot read as a Qualtrics export.
      const limit = error.invalid_params?.find((param) => param.code === "qsf_limit_exceeded")?.identifier;
      return limit ? `${QSF_LIMIT_CODE_PREFIX}${limit}` : "qsf_not_recognized";
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
export const getQsfImportErrorMessage = (
  code: string,
  t: TTranslate,
  retryAfterSeconds: number | null = null
): string => {
  if (code.startsWith(QSF_LIMIT_CODE_PREFIX)) {
    return getQsfLimitMessage(code.slice(QSF_LIMIT_CODE_PREFIX.length), t);
  }

  switch (code) {
    case "qsf_wrong_extension":
      return t("workspace.surveys.import.errors.wrong_extension");
    case "qsf_empty":
      return t("workspace.surveys.import.errors.empty_file");
    case "qsf_too_large":
      return t("workspace.surveys.import.errors.file_too_large");
    case "qsf_not_json":
    case "qsf_not_object":
    case "qsf_not_recognized":
      return t("workspace.surveys.import.errors.not_a_qsf");
    case "qsf_too_complex":
      return t("workspace.surveys.import.errors.too_complex");
    case "qsf_unreadable":
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
    default:
      return getAiErrorMessage(code, t);
  }
};
