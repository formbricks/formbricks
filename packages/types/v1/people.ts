import z from "zod";

export const ZPersonAttributes = z.record(z.union([z.string(), z.number()]));
export type TPersonAttributes = z.infer<typeof ZPersonAttributes>;

export const ZPerson = z.object({
  id: z.string().cuid2(),
  attributes: ZPersonAttributes,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TPerson = z.infer<typeof ZPerson>;
