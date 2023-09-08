import { z } from "zod";

export const ZEnvironment = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  type: z.enum(["development", "production"]),
  productId: z.string(),
  widgetSetupCompleted: z.boolean(),
});

export type TEnvironment = z.infer<typeof ZEnvironment>;

export const ZEnvironmentUpdateInput = z.object({
  type: z.enum(["development", "production"]),
  productId: z.string(),
  widgetSetupCompleted: z.boolean(),
});

export type TEnvironmentUpdateInput = z.infer<typeof ZEnvironmentUpdateInput>;
