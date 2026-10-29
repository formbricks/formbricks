import { z } from "zod";
import { ZId, ZUuid } from "@formbricks/types/common";
import { ZV3InviteMemberBody } from "@/app/api/v3/organizations/lib/schemas";

/** Input of `invite_member`: the v3 body plus the organization, strict so a misspelled key is a loud error. */
export const ZMcpInviteMemberInput = ZV3InviteMemberBody.extend({
  organizationId: ZId.describe("Organization to invite into. Take it from get_account_context."),
}).strict();

export type TMcpInviteMemberInput = z.infer<typeof ZMcpInviteMemberInput>;

const organizationIdField = ZId.describe("Organization the invite belongs to.");
const inviteIdField = ZUuid.describe("Invite id: the id of a kind invite row from list_members.");

/** Input of `resend_invite`. */
export const ZMcpResendInviteInput = z
  .object({ organizationId: organizationIdField, inviteId: inviteIdField })
  .strict();
export type TMcpResendInviteInput = z.infer<typeof ZMcpResendInviteInput>;

/** Input of `delete_invite`. */
export const ZMcpDeleteInviteInput = z
  .object({
    organizationId: organizationIdField,
    inviteId: inviteIdField,
    confirm: z
      .boolean()
      .optional()
      .describe(
        "Must be true to actually delete the invite. Without it nothing is changed and the call only returns what would happen. Set it only after the person has approved this exact change."
      ),
  })
  .strict();
export type TMcpDeleteInviteInput = z.infer<typeof ZMcpDeleteInviteInput>;
