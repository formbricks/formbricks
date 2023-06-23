import { z } from "zod";

export const ZDisplay = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  surveyId: z.string().cuid2(),
  person: z
  .object({
    id: z.string().cuid2(),
    attributes: z.record(z.union([z.string(), z.number()])),
  })
  .nullable(),
  status: z.enum(["seen", "responded"]),
});

export type TDisplay = z.infer<typeof ZDisplay>;

export const ZDisplayInput = z.object({
  surveyId: z.string().cuid2(),
  personId: z.string().cuid2().optional(),
});

export type TDisplayInput = z.infer<typeof ZDisplayInput>;


