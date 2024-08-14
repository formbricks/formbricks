import { z } from "zod";
import { ZActionClass } from "./action-classes";

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
});

export type TActionInput = z.infer<typeof ZActionInput>;
