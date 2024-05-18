import { z } from "zod";

export const ZGoogleTag = z.object({
  id: z.string().cuid2(),
  name: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
  gtmId: z.string(),
  environmentId: z.string().cuid2(),
  surveyIds: z.array(z.string().cuid2()),
});

export type TGoogleTag = z.infer<typeof ZGoogleTag>;

export const ZGoogleTagInput = z.object({
  name: z.string().nullish(),
  gtmId: z.string(),
  surveyIds: z.array(z.string().cuid2()).optional(),
});

export type TGoogleTagInput = z.infer<typeof ZGoogleTagInput>;
