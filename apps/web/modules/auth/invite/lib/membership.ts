import "server-only";
import { createMembership, getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { createTeamMembership } from "@/modules/auth/invite/lib/team";
import { CreateMembershipInvite } from "@/modules/auth/invite/types/invites";

/**
 * Gives the user the organization membership and team memberships an invite grants.
 *
 * An invite only creates a membership. A user who is already a member keeps their role, so a stale
 * invite cannot lower it, an owner's included (ENG-7097). Their team memberships follow the role they
 * actually hold, not the invite's.
 */
export const acceptInviteMembership = async (
  invite: CreateMembershipInvite,
  userId: string
): Promise<void> => {
  const existingMembership = await getMembershipByUserIdOrganizationId(userId, invite.organizationId);
  const role = existingMembership?.role ?? invite.role;

  if (!existingMembership) {
    await createMembership(invite.organizationId, userId, { accepted: true, role });
  }

  if (invite.teamIds) {
    await createTeamMembership(
      { organizationId: invite.organizationId, role, teamIds: invite.teamIds },
      userId
    );
  }
};
