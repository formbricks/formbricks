import "server-only";
import type { TCustomCssError, TCustomCssWarning } from "@formbricks/types/custom-css";
import { CUSTOM_CSS_PLAN_REQUIRED_MESSAGE } from "@/modules/custom-css/lib/access";
import type { TCustomCssWriteOutcome } from "@/modules/custom-css/lib/service";
import { capInvalidParams } from "./invalid-params";
import { type InvalidParam, problemCustomCssInvalid, problemCustomCssPlanRequired } from "./response";

/** Bound on the processor's located errors a single response carries. */
export const V3_CUSTOM_CSS_MAX_REPORTED_ISSUES = 50;

const position = (issue: TCustomCssError | TCustomCssWarning): string =>
  issue.line === null
    ? ""
    : ` (line ${String(issue.line)}${issue.column === null ? "" : `, column ${String(issue.column)}`})`;

/**
 * The processor's errors as `invalid_params`, named after the field they came from
 * (`customCss.light`, `customCss.dark`, or `customCss` for the scope as a whole, e.g. its size).
 */
export const customCssErrorsToInvalidParams = (
  errors: TCustomCssError[],
  prefix = "customCss"
): InvalidParam[] =>
  capInvalidParams(
    errors.map((error) => ({
      name: error.appearance ? `${prefix}.${error.appearance}` : prefix,
      reason: `${error.reason}${position(error)}`,
    })),
    prefix,
    "custom CSS"
  );

export const capCustomCssIssues = <T>(issues: T[]): T[] => issues.slice(0, V3_CUSTOM_CSS_MAX_REPORTED_ISSUES);

/** Thrown by the v3 survey write helpers so the operations can map it to the `custom_css_plan_required` 403. */
export class V3CustomCssPlanRequiredError extends Error {
  constructor() {
    super(CUSTOM_CSS_PLAN_REQUIRED_MESSAGE);
    this.name = "V3CustomCssPlanRequiredError";
  }
}

/** Thrown by the v3 survey write helpers so the operations can map it to the custom CSS 422. */
export class V3CustomCssInvalidError extends Error {
  constructor(readonly errors: TCustomCssError[]) {
    super("Custom CSS failed validation");
    this.name = "V3CustomCssInvalidError";
  }
}

/** A failed write outcome as the error the survey write helpers throw. */
export const toV3CustomCssError = (
  outcome: Extract<TCustomCssWriteOutcome, { ok: false }>
): V3CustomCssPlanRequiredError | V3CustomCssInvalidError =>
  outcome.code === "plan_required"
    ? new V3CustomCssPlanRequiredError()
    : new V3CustomCssInvalidError(outcome.errors);

/** The problem response for a custom CSS failure, or `null` when `error` is something else. */
export const mapV3CustomCssError = (
  error: unknown,
  { requestId, instance }: { requestId: string; instance: string }
): Response | null => {
  if (error instanceof V3CustomCssPlanRequiredError) {
    return problemCustomCssPlanRequired(requestId, error.message, instance);
  }
  if (error instanceof V3CustomCssInvalidError) {
    return problemCustomCssInvalid(requestId, {
      invalid_params: customCssErrorsToInvalidParams(error.errors),
      errors: capCustomCssIssues(error.errors),
      instance,
    });
  }
  return null;
};

/**
 * What a v3 survey write reports back beside the resource. Filled by the write helpers, read by the
 * operations; `customCssWarnings` is set only when the write actually processed custom CSS.
 */
export type TV3SurveyWriteReport = { customCssWarnings?: TCustomCssWarning[] };

/** The additive success-body members for a write report: `warnings` only when CSS was processed. */
export const toV3WriteExtensions = (report: TV3SurveyWriteReport): { warnings?: TCustomCssWarning[] } =>
  report.customCssWarnings ? { warnings: capCustomCssIssues(report.customCssWarnings) } : {};
