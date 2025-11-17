import { z } from "zod";

export const ZEnvironmentId = z.string().cuid();

export type TEnvironmentId = z.infer<typeof ZEnvironmentId>;

export const ZEnvironment = z.object({
  id: ZEnvironmentId,
  createdAt: z.date(),
  updatedAt: z.date(),
  type: z.enum(["development", "production"]),
  projectId: z.string(),
  appSetupCompleted: z.boolean(),
});

export type TEnvironment = z.infer<typeof ZEnvironment>;

export const ZEnvironmentUpdateInput = z.object({
  type: z.enum(["development", "production"]),
  projectId: z.string(),
  appSetupCompleted: z.boolean(),
});

export const ZEnvironmentCreateInput = z.object({
  type: z.enum(["development", "production"]).optional(),
  appSetupCompleted: z.boolean().optional(),
});

export type TEnvironmentCreateInput = z.infer<typeof ZEnvironmentCreateInput>;

export type TEnvironmentUpdateInput = z.infer<typeof ZEnvironmentUpdateInput>;
