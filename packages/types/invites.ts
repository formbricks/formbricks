import { z } from "zod";
import { ZOrganizationRole } from "./memberships";
import { ZUserName } from "./user";

export const ZInvite = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullish(),
  organizationId: z.string(),
  creatorId: z.string(),
  acceptorId: z.string().nullish(),
  createdAt: z.date(),
  expiresAt: z.date(),
  role: ZOrganizationRole,
  teamIds: z.array(z.string()),
});
export type TInvite = z.infer<typeof ZInvite>;

export const ZInvitee = z.object({
  email: z.string().email(),
  name: ZUserName,
  role: ZOrganizationRole,
  teamIds: z.array(z.string()),
});
export type TInvitee = z.infer<typeof ZInvitee>;

export const ZInvitees = z.array(ZInvitee);

export const ZCurrentUser = z.object({
  id: z.string(),
  name: z.string().nullable(),
});
export type TCurrentUser = z.infer<typeof ZCurrentUser>;

export const ZInviteUpdateInput = z.object({
  role: ZOrganizationRole,
});
export type TInviteUpdateInput = z.infer<typeof ZInviteUpdateInput>;

export const ZInviteMembersFormSchema = z.record(
  z.object({
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    name: ZUserName,
  })
);

export type TInviteMembersFormSchema = z.infer<typeof ZInviteMembersFormSchema>;
