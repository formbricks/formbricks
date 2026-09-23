import "server-only";
import { metrics } from "@opentelemetry/api";
import type { TSurveySingleUseLinkRejectionReason } from "@/lib/utils/single-use-surveys";

const meter = metrics.getMeter("formbricks.survey.single_use_link");

const validationsTotal = meter.createCounter("formbricks_survey_single_use_link_validations_total", {
  description:
    "Single-use survey link validations by outcome, rejection reason, encryption mode and calling surface",
});

/** Which of the four entry points validated the link. */
export type TSingleUseLinkSurface =
  | "link_page"
  | "contact_link_page"
  | "client_response_v1"
  | "client_response_v2";

export type TSingleUseLinkValidationMetric = Readonly<{
  outcome: "accepted" | "rejected";
  /**
   * "none" on an ordinary accept, "legacy_unsigned" when the accept came from the
   * SINGLE_USE_LEGACY_UNSIGNED_UNTIL window instead of a signature — the series an operator watches
   * to know whether the window is still carrying traffic and can be closed.
   */
  reason: TSurveySingleUseLinkRejectionReason | "none" | "internal_error" | "legacy_unsigned";
  mode: "encrypted" | "plaintext";
  surface: TSingleUseLinkSurface;
}>;

export const recordSingleUseLinkValidation = (metric: TSingleUseLinkValidationMetric): void => {
  try {
    // Every attribute is a bounded, enumerable value — never an identifier. No surveyId,
    // workspaceId, environmentId or organizationId; no suId, no suToken, not even the token
    // fingerprint that the log line carries. These leave the deployment when an OTLP endpoint is
    // configured, and a metrics backend has none of the log pipeline's retention controls. Which
    // survey was probed belongs in the log line; how much probing there is belongs here.
    validationsTotal.add(1, {
      mode: metric.mode,
      outcome: metric.outcome,
      // "none" on the accept path, mirroring `error_code` in lib/authorization/metrics.ts, so one
      // series sums without a null-handling special case.
      reason: metric.reason,
      surface: metric.surface,
    });
  } catch {
    // Telemetry must never alter the decision, or turn an instrumentation outage into a rejected —
    // or accepted — survey link.
  }
};
