import { z } from "zod";

export const ZEnvironment = z.object({
  id: z.cuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  workspaceId: z.string(),
  appSetupCompleted: z.boolean(),
});

export type TEnvironment = z.infer<typeof ZEnvironment>;
