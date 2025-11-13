import { z } from "zod";
import { type Invite } from "@formbricks/database/generated/client";

export const ZInvite = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  organizationId: z.string(),
  creatorId: z.string(),
  acceptorId: z.string().nullable(),
  createdAt: z.date(),
  expiresAt: z.date(),
  role: z.enum(["owner", "manager", "member", "billing"]),
  teamIds: z.array(z.string()),
}) satisfies z.ZodType<Omit<Invite, "deprecatedRole">>;
