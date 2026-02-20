import { z } from "zod";
import { ZId } from "./common";

export const ZContactAttribute = z.object({
  id: ZId,
  createdAt: z.date(),
  updatedAt: z.date(),
  attributeKeyId: ZId,
  contactId: ZId,
  value: z.string(),
  valueNumber: z.number().nullable(),
  valueDate: z.date().nullable(),
});
export type TContactAttribute = z.infer<typeof ZContactAttribute>;

export const ZContactAttributes = z.record(z.string());
export type TContactAttributes = z.infer<typeof ZContactAttributes>;

export const ZContactAttributesInput = z.record(z.union([z.string(), z.number(), z.boolean()]));
export type TContactAttributesInput = z.infer<typeof ZContactAttributesInput>;
