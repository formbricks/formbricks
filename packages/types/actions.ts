import { z } from "zod";
import { ZActionClass } from "./actionClasses";

export const ZAction = z.object({
  id: z.string(),
  createdAt: z.date(),
  sessionId: z.string(),
  properties: z.record(z.string()),
  actionClass: ZActionClass.nullable(),
});

export type TAction = z.infer<typeof ZAction>;

export const ZActionInput = z.object({
  environmentId: z.string().cuid2(),
  sessionId: z.string().cuid2(),
  name: z.string(),
  properties: z.record(z.string()),
});

export type TActionInput = z.infer<typeof ZActionInput>;
