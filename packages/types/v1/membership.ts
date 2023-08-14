import z from "zod";

export const ZMembershipEnvironment = z.object({
  id: z.string().cuid2(),
  type: z.string(),
});
export const ZMembershipProduct = z.object({
  id: z.string().cuid2(),
  name: z.string(),
  environments: z.array(ZMembershipEnvironment),
});

export const ZMembershipTeam = z.object({
  id: z.string().cuid2(),
  name: z.string(),
  products: z.array(ZMembershipProduct),
});

export const ZMembership = z.object({
  teamId: z.string().cuid2(),
  userId: z.string().cuid2(),
  accepted: z.boolean(),
  role: z.string(),
  team: ZMembershipTeam, // Using the previously defined ZTeam schema here
});

export type TMembershipEnvironment = z.infer<typeof ZMembershipEnvironment>;
export type TMembershipProduct = z.infer<typeof ZMembershipProduct>;
export type TMembership = z.infer<typeof ZMembership>;
