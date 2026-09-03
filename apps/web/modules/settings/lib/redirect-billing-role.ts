import { redirect } from "next/navigation";
import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { getOrganizationBillingPath } from "@/modules/settings/lib/routes";

// Org-scoped equivalent of redirectBillingRoleFromRestrictedSettings (the workspace-scoped guard).
// Bounces a billing-role member away from a restricted org settings page to their billing/enterprise
// home. getOrganizationAuth is React-cached, so calling it here in addition to the page is free.
//
// ENG-2409: was `isBilling -> redirect`, a role-name test that never reached the central interface,
// so the widest gate in the organization settings area (five pages) produced no parity evidence.
//
// `organization.read_access` is the same set. It expands to owner + manager + member — every
// membership role except billing — and getOrganizationAuth has already thrown for a caller with no
// membership at all, so `!read_access` and `isBilling` select exactly the same principals here.
//
// The name is admittedly a stretch: read_access is documented around access-control resources, and
// four of the five pages it guards are not that. It is used anyway because it is the only permission
// whose expansion is "holds a product-eligible membership role", which is what this guard means, and
// because ORGANIZATION_ACTION_BY_ROLE_SET already maps that role set to it. The alternative with the
// right expansion, `product_member`, is deliberately absent from the permission map — it exists only
// to intersect into `team#member`, and giving it a second job would mean a future edit to it
// silently changed team-derived workspace access.
export const redirectBillingRoleFromRestrictedOrgSettings = async (organizationId: string): Promise<void> => {
  const { session } = await getOrganizationAuth(organizationId);

  const hasOrganizationReadAccess = await withAuthorizationSurface("page", () =>
    can({ type: "user", id: session.user.id }, "organization.read_access", {
      type: "organization",
      id: organizationId,
    })
  );

  // Deliberately outside the surface callback: redirect() throws a Next control-flow error, and
  // keeping it out here means the drain scheduled by withAuthorizationSurface never has to survive
  // a throw from inside its own callback.
  if (!hasOrganizationReadAccess) {
    redirect(getOrganizationBillingPath(organizationId, IS_FORMBRICKS_CLOUD));
  }
};
