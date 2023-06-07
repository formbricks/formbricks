import { z } from "zod";

const ZResponse = z.object({
  id: z.string().cuid2(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  surveyId: z.string().cuid2(),
  person: z.object({
    id: z.string().cuid2(),
    attributes: z.record(z.union([z.string(), z.number()])),
  }),
  finished: z.boolean(),
  data: z.record(z.union([z.string(), z.number()])),
});

export const ZResponseInput = z.object({
  surveyId: z.string().cuid2(),
  personId: z.string().cuid2(),
  finished: z.boolean(),
  data: z.record(z.union([z.string(), z.number()])),
});

export type TResponse = z.infer<typeof ZResponse>;
export type TResponseInput = z.infer<typeof ZResponseInput>;
