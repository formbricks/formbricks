import { z } from "zod";
import { ZId } from "./common";

export const ZContactAttribute = z.object({
  id: ZId,
  createdAt: z.date(),
  updatedAt: z.date(),
  attributeKeyId: ZId,
  contactId: ZId,
  value: z.string(),
});
export type TContactAttribute = z.infer<typeof ZContactAttribute>;
