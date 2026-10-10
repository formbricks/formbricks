import "server-only";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { requireRetentionOrgAccess } from "@/modules/ee/data-retention/lib/api-access";
import { getRetentionHealthIssues } from "@/modules/ee/data-retention/lib/health";
import { getRetentionHealthFacts } from "@/modules/ee/data-retention/lib/health-service";
import type { TRetentionHealthQuery } from "../schemas";

/**
 * What can keep data retention from working for this organisation. Owners and managers only: it speaks
 * about the deployment (jobs, SMTP), which members have no use for.
 */
export async function getRetentionHealthOperation({
  authentication,
  query,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  query: TRetentionHealthQuery;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  const access = await requireRetentionOrgAccess({
    authentication,
    organizationId: query.organizationId,
    action: "organization.manage",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const facts = await getRetentionHealthFacts(access.organizationId);
  return successResponse(
    { issues: getRetentionHealthIssues(facts, new Date()), smtpConfigured: facts.smtpConfigured },
    { requestId }
  );
}
