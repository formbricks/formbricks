import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZV3MemberListQuery, ZV3MemberRoleUpdateBody } from "@/app/api/v3/organizations/lib/members-schemas";

const MCP_MEMBER_LIST_DEFAULT_LIMIT = 20;
const MCP_MEMBER_LIST_MAX_LIMIT = 100;

const organizationIdField = ZId.describe("Organization ID. Take it from get_account_context.");
const userIdField = ZId.describe("The member's user id: the id of a kind member row from list_members.");

const confirmDescription = (what: string) =>
  `Must be true to actually ${what}. Without it nothing is changed and the call only returns what would happen. Set it only after the person has approved this exact change.`;

/** Input of `list_members`: the v3 query with a smaller page than REST allows. */
export const ZMcpListMembersInput = ZV3MemberListQuery.extend({
  organizationId: organizationIdField,
  kind: ZV3MemberListQuery.shape.kind.describe(
    "Only members (accepted) or only pending invites. Omit for both."
  ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MCP_MEMBER_LIST_MAX_LIMIT)
    .default(MCP_MEMBER_LIST_DEFAULT_LIMIT)
    .describe(`Page size (default ${MCP_MEMBER_LIST_DEFAULT_LIMIT}, max ${MCP_MEMBER_LIST_MAX_LIMIT}).`),
  cursor: z.string().min(1).optional().describe("Opaque cursor from the previous page's meta.nextCursor."),
}).strict();
export type TMcpListMembersInput = z.infer<typeof ZMcpListMembersInput>;

/** Input of `update_member_role`: the v3 body plus the member, strict so a misspelled key is a loud error. */
export const ZMcpUpdateMemberRoleInput = ZV3MemberRoleUpdateBody.extend({
  organizationId: organizationIdField,
  userId: userIdField,
  confirm: ZV3MemberRoleUpdateBody.shape.confirm.describe(confirmDescription("change the role")),
}).strict();
export type TMcpUpdateMemberRoleInput = z.infer<typeof ZMcpUpdateMemberRoleInput>;

/** Input of `remove_member`. */
export const ZMcpRemoveMemberInput = z
  .object({
    organizationId: organizationIdField,
    userId: userIdField,
    confirm: z.boolean().optional().describe(confirmDescription("remove the member")),
  })
  .strict();
export type TMcpRemoveMemberInput = z.infer<typeof ZMcpRemoveMemberInput>;
