import { z } from "zod";

export const ZAccountInput = z.object({
  userId: z.string(),
  type: z.string(),
  provider: z.string(),
  providerAccountId: z.string(),
  access_token: z.string().nullable(),
  refresh_token: z.string().nullable().optional(),
  expires_at: z.number().nullable(),
  scope: z.string().nullable(),
  token_type: z.string().nullable(),
  id_token: z.string().nullable(),
});

export type TAccountInput = z.infer<typeof ZAccountInput>;

export const ZAccount = ZAccountInput.extend({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TAccount = z.infer<typeof ZAccount>;
