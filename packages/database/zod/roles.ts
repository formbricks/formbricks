import { z } from "zod";

export const ZRoles = z.object({
  data: z.array(
    z.union([z.literal("owner"), z.literal("manager"), z.literal("member"), z.literal("billing")])
  ),
});
