import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZResponseParams = z.object({ responseId: ZId }).strict();

export const ZResponseTagParams = z.object({ responseId: ZId, tagId: ZId }).strict();

/**
 * `DELETE /api/internal/responses/{responseId}` query: whether to give the response's screened-in quota
 * places back. Off unless asked for, as the server action defaulted it.
 */
export const ZDeleteResponseQuery = z
  .object({
    decrementQuotas: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .strict();
