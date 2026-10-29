import { z } from "zod";
import { ZOrganizationRole } from "@formbricks/types/memberships";
import { V3_LIST_DEFAULT_LIMIT, V3_LIST_MAX_LIMIT } from "@/app/api/v3/lib/cursor-pagination";
import { V3_AGENT_INVITABLE_ROLES } from "./schemas";

/** `GET .../members`: people in an organization and its pending invites, one page at a time. */
export const ZV3MemberListQuery = z
  .object({
    kind: z
      .enum(["member", "invite"])
      .optional()
      .describe("Only members (accepted) or only pending invites. Omit for both."),
    limit: z.coerce.number().int().min(1).max(V3_LIST_MAX_LIMIT).default(V3_LIST_DEFAULT_LIMIT),
    cursor: z.string().min(1).optional(),
  })
  .strict();
export type TV3MemberListQuery = z.infer<typeof ZV3MemberListQuery>;

/** One line of the member list: an accepted membership or a pending invite. */
export const ZV3MemberRow = z.object({
  kind: z.enum(["member", "invite"]),
  id: z.string().describe("The user id for a member, the invite id for an invite."),
  name: z.string(),
  email: z.string(),
  role: ZOrganizationRole,
  status: z.enum(["active", "inactive", "pending", "expired"]),
  twoFactorEnabled: z
    .boolean()
    .nullable()
    .describe("Null for an invite and for a viewer who is not an owner or manager."),
  teamNames: z
    .array(z.string())
    .nullable()
    .describe("Null for a viewer who is not an owner or manager. Owners and managers belong to every team."),
  invitedAt: z.string().nullable().describe("Invites only: when the invite was sent."),
});
export type TV3MemberRow = z.infer<typeof ZV3MemberRow>;

export const ZV3MemberListMeta = z.object({
  limit: z.number().int(),
  nextCursor: z.string().nullable(),
  totalCount: z.number().int(),
  totalCountRelation: z.enum(["eq", "gte"]),
});
export type TV3MemberListMeta = z.infer<typeof ZV3MemberListMeta>;

/**
 * `PATCH .../members/{userId}` body. Only `member` and `manager` are grantable by an agent: `owner` is full
 * control and `billing` is a finance seat, both a person's decision in the app.
 */
export const ZV3MemberRoleUpdateBody = z
  .object({
    role: z
      .enum(V3_AGENT_INVITABLE_ROLES)
      .describe("New organization role: member or manager (only an owner may grant manager)."),
    confirm: z
      .boolean()
      .optional()
      .describe(
        "Must be true to actually change the role. Without it nothing is changed and the call only returns what would happen. Set it only after the person has approved this exact change."
      ),
  })
  .strict();
export type TV3MemberRoleUpdateBody = z.infer<typeof ZV3MemberRoleUpdateBody>;

export const ZV3MemberRoleUpdateResource = z.object({
  status: z.enum(["preview", "updated", "unchanged"]),
  organizationId: z.string(),
  userId: z.string(),
  previousRole: ZOrganizationRole,
  role: z.enum(V3_AGENT_INVITABLE_ROLES),
  lowersAccess: z.boolean().describe("True when the new role has less access than the previous one."),
  message: z.string(),
});
export type TV3MemberRoleUpdateResource = z.infer<typeof ZV3MemberRoleUpdateResource>;

/** `DELETE` calls carry `confirm` in the query, as the string `true` or `false`. */
export const ZV3ConfirmQuery = z
  .object({
    confirm: z.enum(["true", "false"]).optional(),
  })
  .strict();
export type TV3ConfirmQuery = z.infer<typeof ZV3ConfirmQuery>;

export const ZV3MemberRemoveResource = z.object({
  status: z.enum(["preview", "removed"]),
  organizationId: z.string(),
  userId: z.string(),
  role: ZOrganizationRole,
  message: z.string(),
});
export type TV3MemberRemoveResource = z.infer<typeof ZV3MemberRemoveResource>;

export const ZV3InviteDeleteResource = z.object({
  status: z.enum(["preview", "deleted"]),
  organizationId: z.string(),
  inviteId: z.string(),
  role: ZOrganizationRole,
  message: z.string(),
});
export type TV3InviteDeleteResource = z.infer<typeof ZV3InviteDeleteResource>;

export const ZV3InviteResendResource = z.object({
  status: z.literal("resent"),
  organizationId: z.string(),
  inviteId: z.string(),
  role: ZOrganizationRole,
  expiresAt: z.string(),
  emailSent: z.boolean(),
  message: z.string(),
});
export type TV3InviteResendResource = z.infer<typeof ZV3InviteResendResource>;
