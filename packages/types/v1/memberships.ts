import z from "zod";

export const ZMembership = z.object({
  name: z.string().nullable(),
  email: z.string(),
  userId: z.string(),
  accepted: z.boolean(),
  role: z.enum(["owner", "admin", "editor", "developer", "viewer"]),
});

export type TMembership = z.infer<typeof ZMembership>;
