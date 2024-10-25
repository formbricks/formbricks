import { z } from "zod";
import { ZId } from "./common";

export const ZContact = z.object({
  id: ZId,
  createdAt: z.date(),
  updatedAt: z.date(),
  environmentId: ZId,
});

export type TContact = z.infer<typeof ZContact>;
