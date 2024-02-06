import { z } from "zod";

import { ZJSStateDisplay } from "./js";
import { ZPersonAttributes } from "./people";
import { ZProduct } from "./product";
import { ZSurvey } from "./surveys";

export const ZRNState = z.object({
  attributes: ZPersonAttributes,
  surveys: z.array(ZSurvey),
  product: ZProduct,
  displays: z.array(ZJSStateDisplay).optional(),
});

export type TRNState = z.infer<typeof ZRNState>;

export const ZRNConfig = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  userId: z.string(),
  state: ZRNState,
  expiresAt: z.date(),
});

export type TRNConfig = z.infer<typeof ZRNConfig>;

export const ZRNConfigInput = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  debug: z.boolean().optional(),
  errorHandler: z.function().args(z.any()).returns(z.void()).optional(),
  userId: z.string(),
  attributes: ZPersonAttributes.optional(),
});

export type TRNConfigInput = z.infer<typeof ZRNConfigInput>;

export const ZRNConfigUpdateInput = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  userId: z.string(),
  state: ZRNState,
});

export type TRNConfigUpdateInput = z.infer<typeof ZRNConfigUpdateInput>;

// force user identification
export const ZRNSyncParams = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  userId: z.string(),
});

export type TRNSyncParams = z.infer<typeof ZRNSyncParams>;
