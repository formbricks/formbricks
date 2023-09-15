import z from "zod";

export const ZMembershipRole = z.enum(["owner", "admin", "editor", "developer", "viewer"]);

export type TMembershipRole = z.infer<typeof ZMembershipRole>;

export const ZMembership = z.object({
  teamId: z.string(),
  userId: z.string(),
  accepted: z.boolean(),
  role: ZMembershipRole,
});

export type TMembership = z.infer<typeof ZMembership>;
