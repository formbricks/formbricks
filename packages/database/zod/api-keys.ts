import { type ApiKey } from "@prisma/client";
import { z } from "zod";

export const ZApiKey = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  lastUsedAt: z.date().nullable(),
  label: z.string().nullable(),
  hashedKey: z.string(),
  environmentId: z.string().cuid2(),
}) satisfies z.ZodType<ApiKey>;
