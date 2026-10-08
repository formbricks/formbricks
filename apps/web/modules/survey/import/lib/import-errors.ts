import type { V3ApiError } from "@/modules/api/lib/v3-client";
import { getAiErrorMessage } from "@/modules/survey/components/template-list/lib/ai-error-messages";

type TTranslate = (key: string, options?: Record<string, unknown>) => string;

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
    case 422:
      return "qsf_not_recognized";
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
