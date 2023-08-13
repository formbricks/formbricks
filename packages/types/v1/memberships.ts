import z from "zod";

export const ZMembershipRole = z.enum(["owner", "admin", "editor", "developer", "viewer"]);

export const ZMembership = z.object({
  teamId: z.string(),
  userId: z.string(),
  accepted: z.boolean(),
  role: ZMembershipRole,
});

export const ZMember = z.object({
  name: z.string().nullable(),
  email: z.string(),
  userId: z.string(),
  accepted: z.boolean(),
  role: ZMembershipRole,
});

export type TMembership = z.infer<typeof ZMembership>;
export type TMember = z.infer<typeof ZMember>;
export type TMembershipRole = z.infer<typeof ZMembershipRole>;
