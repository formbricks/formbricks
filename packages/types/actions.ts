import { z } from "zod";
import { ZActionClass } from "./action-classes";
import { ZId } from "./common";

export const ZAction = z.object({
  id: ZId,
  createdAt: z.date(),
  personId: ZId,
  properties: z.record(z.string()),
  actionClass: ZActionClass.nullable(),
});

export type TAction = z.infer<typeof ZAction>;

export const ZActionInput = z.object({
  environmentId: ZId,
  userId: ZId,
  name: z.string(),
});

export type TActionInput = z.infer<typeof ZActionInput>;
