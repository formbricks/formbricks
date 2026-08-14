import { TOrganizationRole } from "@formbricks/types/memberships";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";

/**
 * The organization roles allowed on the onboarding invite path (ENG-2169).
 *
 * Deliberately narrower than the org settings invite path, where managers may invite members: this
 * path takes no role input and `inviteUser` always persists an owner invite, so adding "manager"
 * here lets a manager mint an owner without an existing owner's approval. Nothing legitimate is
 * lost — the only entry to this screen is the redirect right after `createOrganizationAction`,
 * which makes the creator an owner.
 *
 * Both the page gate and the action authorization derive from this list so the two cannot drift.
 */
export const SETUP_INVITE_ROLES: TOrganizationRole[] = ["owner"];

/** Throws `AuthorizationError` unless the user may invite through the onboarding path. */
export const checkSetupInviteAuthorization = async (
  userId: string,
  organizationId: string
): Promise<void> => {
  await checkAuthorizationUpdated({
    userId,
    organizationId,
    access: [
      {
        type: "organization",
        roles: SETUP_INVITE_ROLES,
      },
    ],
  });
};

/** Non-throwing variant for the page gate, which renders a 404 instead of surfacing an error. */
export const hasSetupInviteAccess = async (userId: string, organizationId: string): Promise<boolean> => {
  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);

  return membership ? SETUP_INVITE_ROLES.includes(membership.role) : false;
};
