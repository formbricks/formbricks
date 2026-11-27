import { z } from "zod";
import { ZId, ZUuid } from "@formbricks/types/common";
import { ZOrganizationRole } from "@formbricks/types/memberships";
import { ZUserEmail } from "@formbricks/types/user";
import { ZInviteUpdateInput } from "@/modules/ee/role-management/types/invites";
import { ZInvitee } from "@/modules/organization/settings/teams/types/invites";

/** Hard cap on a single bulk import, to bound payload size and email fan-out. */
export const BULK_INVITE_MAX_INVITEES = 500;

/**
 * Cap on the teams one invite may name. A team admin's authorization is decided per named team, so without a
 * cap the number of authorization decisions would follow the request body. The UI offers the teams the
 * inviter can see, so this is far above any real selection.
 */
export const INVITE_MAX_TEAMS = 100;

/** Longest invitee name and team id an invite carries (CODING_STANDARDS.md "Input Limits"). */
export const INVITEE_NAME_MAX = 255;
const TEAM_ID_MAX = 255;

/** `/api/internal/invites/{inviteId}` path. */
export const ZInviteIdParams = z.object({ inviteId: ZUuid }).strict();

/** `?organizationId=`: the organization an invite is sent for. */
export const ZInviteOrganizationQuery = z.object({ organizationId: ZId }).strict();

/** `PATCH /api/internal/invites/{inviteId}` body: the role the invitee joins with. */
export const ZInviteUpdateBody = ZInviteUpdateInput.strict();
export type TInviteUpdateBody = z.infer<typeof ZInviteUpdateBody>;

/** `POST /api/internal/invites?organizationId=`: one invitee, from the invite form. */
export const ZInviteCreateBody = z
  .object({
    // One address: anything else would let one invite, and one unit of the invite budget, reach several
    // inboxes (ENG-6658).
    email: ZUserEmail,
    name: z.string().trim().min(1, "Name is required").max(INVITEE_NAME_MAX),
    role: ZOrganizationRole,
    teamIds: z.array(ZId).max(INVITE_MAX_TEAMS, `An invite is limited to ${INVITE_MAX_TEAMS} teams`),
  })
  .strict();
export type TInviteCreateBody = z.infer<typeof ZInviteCreateBody>;

/** `POST /api/internal/invites/batches?organizationId=`: the rows of a CSV bulk invite. */
export const ZInviteBatchBody = z
  .object({
    invitees: z
      .array(
        ZInvitee.extend({
          email: ZInvitee.shape.email.max(255),
          name: ZInvitee.shape.name.max(INVITEE_NAME_MAX),
          teamIds: z
            .array(z.string().max(TEAM_ID_MAX))
            .max(INVITE_MAX_TEAMS, `An invite is limited to ${INVITE_MAX_TEAMS} teams`),
        }).strict()
      )
      .min(1, "No invitees provided")
      .max(
        BULK_INVITE_MAX_INVITEES,
        `A bulk invite is limited to ${BULK_INVITE_MAX_INVITEES} members at a time`
      ),
  })
  .strict();
export type TInviteBatchBody = z.infer<typeof ZInviteBatchBody>;
