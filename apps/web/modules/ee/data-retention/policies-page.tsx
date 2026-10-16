import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { RetentionPoliciesView } from "./components/policies/retention-policies-view";

/**
 * The Policies tab. Every member reads it; owners and managers change and pause policies. The layout
 * has already checked the entitlement.
 */
export const DataRetentionPoliciesPage = async ({
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

  return <RetentionPoliciesView organizationId={organization.id} canManage={canManage} />;
};
