import { z } from "zod";

export const ZEnvironment = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  type: z.enum(["development", "production"]),
  productId: z.string(),
  appSetupCompleted: z.boolean(),
  websiteSetupCompleted: z.boolean(),
});

export type TEnvironment = z.infer<typeof ZEnvironment>;

export const ZEnvironmentId = z.object({
  id: z.string(),
});

export type TEnvironmentId = z.infer<typeof ZEnvironmentId>;

export const ZEnvironmentUpdateInput = z.object({
  type: z.enum(["development", "production"]),
  productId: z.string(),
  appSetupCompleted: z.boolean(),
  websiteSetupCompleted: z.boolean(),
});

export const ZEnvironmentCreateInput = z.object({
  type: z.enum(["development", "production"]).optional(),
  appSetupCompleted: z.boolean().optional(),
  websiteSetupCompleted: z.boolean().optional(),
});

export type TEnvironmentCreateInput = z.infer<typeof ZEnvironmentCreateInput>;

export type TEnvironmentUpdateInput = z.infer<typeof ZEnvironmentUpdateInput>;
