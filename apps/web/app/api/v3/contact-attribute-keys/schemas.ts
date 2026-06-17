import { z } from "zod";

export const ZV3ContactAttributeKeyListQuery = z
  .object({
    workspaceId: z.cuid2(),
  })
  .strict();

export type TV3ContactAttributeKeyListQuery = z.infer<typeof ZV3ContactAttributeKeyListQuery>;
