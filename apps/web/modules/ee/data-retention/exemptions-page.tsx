import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { RetentionExemptionsView } from "./components/exemptions/retention-exemptions-view";

/**
 * The Exemptions tab. Every member reads it (each only for surveys they could open, which the API
 * enforces); owners and managers also add and revoke. The layout has already checked the entitlement.
 */
export const DataRetentionExemptionsPage = async ({
  params,
}: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const { organizationId } = await params;
  const { organization, session } = await getOrganizationAuth(organizationId);

  const canManage = await withAuthorizationSurface("page", () =>
    can({ type: "user", id: session.user.id }, "organization.manage", {
      type: "organization",
      id: organization.id,
    })
  );

  return (
    <RetentionExemptionsView
      organizationId={organization.id}
      timeZone={getReportingTimeZone(organization.displayTimeZone)}
      canManage={canManage}
    />
  );
};
