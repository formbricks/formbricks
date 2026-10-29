import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZV3InviteMemberBody } from "@/app/api/v3/organizations/lib/schemas";

/** Input of `invite_member`: the v3 body plus the organization, strict so a misspelled key is a loud error. */
export const ZMcpInviteMemberInput = ZV3InviteMemberBody.extend({
  organizationId: ZId.describe("Organization to invite into. Take it from get_account_context."),
}).strict();

export type TMcpInviteMemberInput = z.infer<typeof ZMcpInviteMemberInput>;
