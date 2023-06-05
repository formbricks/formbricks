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
  data: z.record(z.union([z.string(), z.number()])),
});

export type TResponse = z.infer<typeof ZResponse>;
