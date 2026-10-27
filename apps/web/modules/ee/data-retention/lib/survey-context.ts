import "server-only";
import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { getIsDataRetentionEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TSurveyDataRetentionContext } from "../types";

/** The data retention context for a survey page; see `TSurveyDataRetentionContext`. */
export async function getSurveyDataRetentionContext(
  organization: { id: string; displayTimeZone?: string | null },
  userId: string
): Promise<TSurveyDataRetentionContext> {
  if (!(await getIsDataRetentionEnabled(organization.id))) return null;

  const canExempt = await withAuthorizationSurface("page", () =>
    can({ type: "user", id: userId }, "organization.manage", { type: "organization", id: organization.id })
  );
  return {
    organizationId: organization.id,
    timeZone: getReportingTimeZone(organization.displayTimeZone),
    canExempt,
  };
}
