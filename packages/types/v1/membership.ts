import { z } from "zod";

export const ZMembershipRole = z.enum(["owner", "admin", "editor", "developer", "viewer"]);

export const ZMembership = z.object({
  role: ZMembershipRole,
  userId: z.string(),
});

export type TMembership = z.infer<typeof ZMembership>;
export type TMembershipRole = z.infer<typeof ZMembershipRole>;
