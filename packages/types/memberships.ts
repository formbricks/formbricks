import { z } from "zod";

export const ZMembershipRole = z.enum(["owner", "admin", "editor", "developer", "viewer"]);
export const ZOrganizationRole = z.enum(["owner", "manager", "member", "billing"]);

export type TMembershipRole = z.infer<typeof ZMembershipRole>;
export type TOrganizationRole = z.infer<typeof ZOrganizationRole>;

export const ZMembership = z.object({
  organizationId: z.string(),
  userId: z.string(),
  accepted: z.boolean(),
  role: ZOrganizationRole,
});

export type TMembership = z.infer<typeof ZMembership>;

export const ZMember = z.object({
  name: z.string().nullable(),
  email: z.string().email(),
  userId: z.string(),
  accepted: z.boolean(),
  role: ZOrganizationRole,
  isActive: z.boolean(),
});

export type TMember = z.infer<typeof ZMember>;

export const ZMembershipUpdateInput = z.object({
  role: ZOrganizationRole,
});
export type TMembershipUpdateInput = z.infer<typeof ZMembershipUpdateInput>;
