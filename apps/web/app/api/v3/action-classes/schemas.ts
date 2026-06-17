import { z } from "zod";

export const ZV3ActionClassListQuery = z
  .object({
    workspaceId: z.cuid2(),
  })
  .strict();

export type TV3ActionClassListQuery = z.infer<typeof ZV3ActionClassListQuery>;
