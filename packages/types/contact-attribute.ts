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

export const ZContactAttributeUpdateInput = z.object({
  environmentId: z.string().cuid2(),
  contactId: z.string(),
  attributes: z.record(z.union([z.string(), z.number()])),
});

export type TContactAttributeUpdateInput = z.infer<typeof ZContactAttributeUpdateInput>;

export const ZContactAttributes = z.record(z.string());
export type TContactAttributes = z.infer<typeof ZContactAttributes>;
