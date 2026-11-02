import "server-only";
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { logger } from "@formbricks/logger";
import { SES_EMAIL_ENVIRONMENT } from "@/lib/constants";

const cloudwatch = new CloudWatchClient({ region: "eu-central-1" });

export const reportEmailAuditFailure = async (
  event:
    | "email_audit_gap"
    | "email_audit_stale_prepared"
    | "email_audit_content_delete_failed"
    | "email_audit_erasure_request_failed",
  detail: Readonly<{ auditId?: string; phase?: string; count?: number }>
): Promise<void> => {
  logger.error({ event, ...detail }, "Email send audit requires attention");
  try {
    await cloudwatch.send(
      new PutMetricDataCommand({
        Namespace: "Formbricks/EmailAudit",
        MetricData: [
          {
            MetricName: event,
            Value: detail.count ?? 1,
            Unit: "Count",
            Dimensions: [{ Name: "Environment", Value: SES_EMAIL_ENVIRONMENT ?? "unknown" }],
          },
        ],
      })
    );
  } catch {
    logger.error({ event: "email_audit_metric_publish_failed" }, "Email audit metric delivery failed");
  }
};
