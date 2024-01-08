import z from "zod";

export const ZPersonAttributes = z.record(z.union([z.string(), z.number()]));
export type TPersonAttributes = z.infer<typeof ZPersonAttributes>;

export const ZPerson = z.object({
  id: z.string().cuid2(),
  userId: z.string(),
  attributes: ZPersonAttributes,
  createdAt: z.date(),
  updatedAt: z.date(),
  environmentId: z.string().cuid2(),
});

export type TPerson = z.infer<typeof ZPerson>;

export const ZPersonUpdateInput = z.object({
  attributes: ZPersonAttributes,
});

export type TPersonUpdateInput = z.infer<typeof ZPersonUpdateInput>;

export const ZPersonClient = z.object({
  id: z.string().cuid2(),
  userId: z.string(),
  attributes: ZPersonAttributes.optional(),
});

export type TPersonClient = z.infer<typeof ZPersonClient>;
