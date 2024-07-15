import { z } from "zod";
import { ZMembershipRole } from "./memberships";

export const ZInvite = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullish(),
  organizationId: z.string(),
  creatorId: z.string(),
  acceptorId: z.string().nullish(),
  accepted: z.boolean(),
  createdAt: z.date(),
  expiresAt: z.date(),
  role: ZMembershipRole,
});
export type TInvite = z.infer<typeof ZInvite>;

export const ZInvitee = z.object({
  email: z.string().email(),
  name: z.string(),
  role: ZMembershipRole,
});
export type TInvitee = z.infer<typeof ZInvitee>;

export const ZInvitees = z.array(ZInvitee);

export const ZCurrentUser = z.object({
  id: z.string(),
  name: z.string().nullable(),
});
export type TCurrentUser = z.infer<typeof ZCurrentUser>;

export const ZInviteUpdateInput = z.object({
  role: ZMembershipRole,
});
export type TInviteUpdateInput = z.infer<typeof ZInviteUpdateInput>;

export const ZInviteMembersFormSchema = z.record(
  z.string().email("Invalid email address").optional().or(z.literal(""))
);

export type TInviteMembersFormSchema = z.infer<typeof ZInviteMembersFormSchema>;
