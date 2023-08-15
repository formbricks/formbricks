import { z } from "zod";
import { EventType } from "@prisma/client";
import { ZActionClassNoCodeConfig } from "./actionClasses";

const ZEventClass = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.nativeEnum(EventType),
  noCodeConfig: ZActionClassNoCodeConfig.nullable(),
  environmentId: z.string(),
});

export const ZEvent = z.object({
  id: z.string(),
  createdAt: z.date(),
  eventClassId: z.string().nullable(),
  sessionId: z.string(),
  properties: z.record(z.unknown()),
  eventClass: ZEventClass.nullable(),
});

export type TEvent = z.infer<typeof ZEvent>;
