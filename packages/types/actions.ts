import { z } from "zod";

import { ZActionClass } from "./actionClasses";

export const ZAction = z.object({
  id: z.string(),
  createdAt: z.date(),
  personId: z.string(),
  properties: z.record(z.string()),
  actionClass: ZActionClass.nullable(),
});

export type TAction = z.infer<typeof ZAction>;

export const ZActionInput = z.object({
  environmentId: z.string().cuid(),
  userId: z.string(),
  name: z.string(),
  properties: z.record(z.string()),
});

export type TActionInput = z.infer<typeof ZActionInput>;

export const ZActionLegacyInput = z.object({
  environmentId: z.string().cuid2(),
  personId: z.string().optional(),
  sessionId: z.string().optional(),
  name: z.string(),
  properties: z.record(z.string()),
});

export type TActionLegacyInput = z.infer<typeof ZActionLegacyInput>;
