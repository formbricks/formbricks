import z from "zod";
import { ZPerson } from "./people";
import { ZSession } from "./sessions";
import { ZSurvey } from "./surveys";
import { ZActionClass } from "./actionClasses";
import { ZProduct } from "./product";

export const ZJsState = z.object({
  person: ZPerson,
  session: ZSession,
  surveys: z.array(ZSurvey),
  noCodeActionClasses: z.array(ZActionClass),
  product: ZProduct,
});

export type TJsState = z.infer<typeof ZJsState>;

export const ZJsSyncInput = z.object({
  environmentId: z.string().cuid2(),
  personId: z.string().cuid2().optional(),
  sessionId: z.string().cuid2().optional(),
  jsVersion: z.string().optional(),
});

export type TJsSyncInput = z.infer<typeof ZJsSyncInput>;

export const ZJsConfig = z.object({
  environmentId: z.string().cuid2(),
  apiHost: z.string(),
  state: ZJsState,
});

export type TJsConfig = z.infer<typeof ZJsConfig>;

export const ZJsPeopleUserIdInput = z.object({
  environmentId: z.string().cuid2(),
  userId: z.string().min(1).max(255),
  sessionId: z.string().cuid2(),
});

export type TJsPeopleUserIdInput = z.infer<typeof ZJsPeopleUserIdInput>;

export const ZJsPeopleAttributeInput = z.object({
  environmentId: z.string().cuid2(),
  sessionId: z.string().cuid2(),
  key: z.string(),
  value: z.string(),
});

export type TJsPeopleAttributeInput = z.infer<typeof ZJsPeopleAttributeInput>;

export const ZJsActionInput = z.object({
  environmentId: z.string().cuid2(),
  sessionId: z.string().cuid2(),
  name: z.string(),
  properties: z.record(z.string()),
});

export type TJsActionInput = z.infer<typeof ZJsActionInput>;
