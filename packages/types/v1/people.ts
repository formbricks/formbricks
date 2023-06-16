import z from "zod";

export const ZPerson = z.object({
  id: z.string().cuid2(),
  attributes: z.record(z.union([z.string(), z.number()])),
});

export type TPerson = z.infer<typeof ZPerson>;
