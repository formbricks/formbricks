import { z } from "zod";

export const ZContactAttributeUpdateInput = z.object({
  environmentId: z.string().cuid2(),
  contactId: z.string(),
  attributes: z.record(z.union([z.string(), z.number()])),
});

export type TContactAttributeUpdateInput = z.infer<typeof ZContactAttributeUpdateInput>;

export const ZContactAttributes = z.record(
  z.object({
    name: z.string().nullable(),
    value: z.string(),
  })
);
export type TContactAttributes = z.infer<typeof ZContactAttributes>;
