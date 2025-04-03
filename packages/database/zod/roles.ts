import { z } from "zod";

export const ZRoles = z.object({
  data: z.array(z.string()),
});
