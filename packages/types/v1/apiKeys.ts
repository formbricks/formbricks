import { z } from "zod";

export const ZApiKey = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  lastUsedAt: z.date().nullable(),
  label: z.string().nullable(),
  hashedKey: z.string(),
  environmentId: z.string().cuid2(),
  apiKey: z.string().optional(),
});

export type TApiKey = z.infer<typeof ZApiKey>;

export const ZApiKeyCreateInput = z.object({
  label: z.string(),
});
export type TApiKeyCreateInput = z.infer<typeof ZApiKeyCreateInput>;
