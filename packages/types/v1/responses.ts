import { z } from "zod";

const ZResponse = z.object({
  id: z.string().cuid2(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  surveyId: z.string().cuid2(),
  personId: z.string().cuid2(),
  data: z.record(z.union([z.string(), z.number()])),
});

export type TResponse = z.infer<typeof ZResponse>;
