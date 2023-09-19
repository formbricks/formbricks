import z from "zod";
import { Prisma } from "@prisma/client";
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
export type TInviteUpdateInput = Prisma.InviteUpdateInput;
