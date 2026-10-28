import { z } from "zod";
import { ZActionClassType } from "@formbricks/types/action-classes";

/** An action class as the v3 API answers it, so MCP output schemas derive from it instead of retyping the shape. */
export const ZV3ActionClassResource = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: ZActionClassType,
  key: z.string().nullable(),
});
