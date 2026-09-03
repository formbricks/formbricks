import { cache as reactCache } from "react";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganization } from "@/lib/organization/service";
import { getTranslate } from "@/lingodotdev/server";
import { getSession } from "@/modules/auth/lib/session";
import { TOrganizationAuth } from "../types/organization-auth";

/**
 * Common utility to fetch organization data and perform authorization checks
 *
 * Usage:
 *   const { session, organization, ... } = await getOrganizationAuth(params.organizationId);
 *
 * Deliberately gates on membership only (`organization.read`), never on a product permission —
 * unlike `getWorkspaceAuth`, which redirects the billing role away from product data. The
 * asymmetry is required, not an oversight: `modules/ee/billing/page.tsx` is the billing role's
 * own page, so a billing exclusion here would lock that role out of the one surface it exists to
 * reach. Callers that need to exclude billing do so themselves, via
 * `redirectBillingRoleFromRestrictedOrgSettings`.
 *
 * The role flags below stay for rendering (isReadOnly, isDeleteDisabled, membershipRole) — retained
 * by design, see lib/authorization/README.md. What ENG-2409 moved is the *gate*, not the flags.
 */
export const getOrganizationAuth = reactCache(async (organizationId: string): Promise<TOrganizationAuth> => {
  const t = await getTranslate();

  // Perform all fetches in parallel
  const [session, organization] = await Promise.all([getSession(), getOrganization(organizationId)]);

  if (!session) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  if (!organization) {
    throw new ResourceNotFoundError(t("common.organization"), organizationId);
  }

  // ENG-2409: the tenancy gate. This was `if (!currentUserMembership) throw`, a decision made by
  // reading a row rather than by asking the central interface. Keeping it as an explicit
  // `organization.read` decision makes SpiceDB authoritative for this gate.
  //
  // `organization.read` is the same set. The schema grants it to owner + manager + member + billing
  // (schema.zed:69) — every membership role and nobody else — so "holds this permission" and "has a
  // membership row" describe the same principals.
  //
  // Run alongside the membership read rather than after it. SpiceDB decides the capability while
  // PostgreSQL still supplies the role flags rendered by the page.
  const [hasOrganizationRead, currentUserMembership] = await Promise.all([
    withAuthorizationSurface("page", () =>
      can({ type: "user", id: session.user.id }, "organization.read", {
        type: "organization",
        id: organization.id,
      })
    ),
    getMembershipByUserIdOrganizationId(session.user.id, organization.id),
  ]);

  // The membership is still required, and not only for the flags below: SpiceDB
  // could allow while the row is absent (projection drift), and `TOrganizationAuth` promises a
  // non-null membership to every caller. Keeping both conditions on one throw preserves the exact
  // error this has always raised while making the authorization half of it comparable.
  if (!hasOrganizationRead || !currentUserMembership) {
    throw new ResourceNotFoundError(t("common.membership"), null);
  }

  const { isMember, isOwner, isManager, isBilling } = getAccessFlags(currentUserMembership.role);

  return {
    organization,
    session,
    currentUserMembership,
    isMember,
    isOwner,
    isManager,
    isBilling,
  };
});
