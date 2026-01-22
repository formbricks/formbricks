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

// For display purposes (attributes are always stored as strings in value column)
export const ZContactAttributes = z.record(z.string());
export type TContactAttributes = z.infer<typeof ZContactAttributes>;

// For SDK input - accepts string or number (Date is converted to ISO string by SDK)
export const ZContactAttributesInput = z.record(z.union([z.string(), z.number()]));
export type TContactAttributesInput = z.infer<typeof ZContactAttributesInput>;
