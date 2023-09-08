import { z } from "zod";

export const ZMembershipRole = z.union([
  z.literal("owner"),
  z.literal("admin"),
  z.literal("editor"),
  z.literal("developer"),
  z.literal("viewer"),
]);

export const ZMembership = z.object({
  role: ZMembershipRole,
  userId: z.string(),
});

export type TMembership = z.infer<typeof ZMembership>;
export type TMembershipRole = z.infer<typeof ZMembershipRole>;
