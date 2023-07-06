import { z } from "zod";

export const ZEnvironment: any = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  type: z.enum(["development", "production"]),
  productId: z.string(),
  widgetSetupCompleted: z.boolean(),
});

export type TEnvironment = z.infer<typeof ZEnvironment>;
