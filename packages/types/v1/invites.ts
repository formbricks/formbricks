import z from "zod";
import { ZMembershipRole } from "./memberships";

const ZInvite = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullish(),
  teamId: z.string(),
  creatorId: z.string(),
  acceptorId: z.string().nullish(),
  accepted: z.boolean(),
  createdAt: z.date(),
  expiresAt: z.date(),
  role: ZMembershipRole,
});
export type TInvite = z.infer<typeof ZInvite>;

export const ZInvitee = z.object({
  email: z.string(),
  name: z.string(),
  role: ZMembershipRole,
});
export type TInvitee = z.infer<typeof ZInvitee>;

export const ZCurrentUser = z.object({
  id: z.string(),
  name: z.string(),
});
export type TCurrentUser = z.infer<typeof ZCurrentUser>;

export const ZInviteUpdateInput = z.object({
  role: ZMembershipRole,
});
export type TInviteUpdateInput = z.infer<typeof ZInviteUpdateInput>;
