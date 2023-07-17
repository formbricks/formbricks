import z from "zod";
import { ZActionClassNoCodeConfig } from "./actionClasses";

export const ZAction = z.object({
  id: z.string().cuid2(),
  name: z.string(),
  description: z.string(),
  type: z.enum(["code", "noCode", "automatic"]),
  noCodeConfig: z.union([ZActionClassNoCodeConfig, z.null()]),
  environmentId: z.string(),
  actionCount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TAction = z.infer<typeof ZAction>;

export const ZActionInput = z.object({
  name: z.string(),
  description: z.union([z.string(), z.null()]),
  noCodeConfig: z.union([ZActionClassNoCodeConfig, z.null()]),
  type: z.enum(["code", "noCode", "automatic"]),
});

export type TActionInput = z.infer<typeof ZActionInput>;
