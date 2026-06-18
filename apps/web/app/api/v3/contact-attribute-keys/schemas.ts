import { z } from "zod";
import { V3_LIST_DEFAULT_LIMIT, V3_LIST_MAX_LIMIT } from "@/app/api/v3/lib/cursor-pagination";

export const ZV3ContactAttributeKeyListQuery = z
  .object({
    workspaceId: z.cuid2(),
    limit: z.coerce.number().int().min(1).max(V3_LIST_MAX_LIMIT).default(V3_LIST_DEFAULT_LIMIT),
    cursor: z.string().min(1).optional(),
  })
  .strict();

export type TV3ContactAttributeKeyListQuery = z.infer<typeof ZV3ContactAttributeKeyListQuery>;
