import { z } from "zod";

export const ZResponseData = z.record(z.union([z.string(), z.number(), z.array(z.string())]));
export type TResponseData = z.infer<typeof ZResponseData>;

export const ZResponseVariables = z.record(z.union([z.string(), z.number()]));
export type TResponseVariables = z.infer<typeof ZResponseVariables>;

export const ZResponseTtc = z.record(z.number());
export type TResponseTtc = z.infer<typeof ZResponseTtc>;

export const ZResponseHiddenFieldValue = z.record(z.union([z.string(), z.number(), z.array(z.string())]));
export type TResponseHiddenFieldValue = z.infer<typeof ZResponseHiddenFieldValue>;

export const ZResponseUpdate = z.object({
  finished: z.boolean(),
  data: ZResponseData,
  language: z.string().optional(),
  variables: ZResponseVariables.optional(),
  ttc: ZResponseTtc.optional(),
  meta: z
    .object({
      url: z.string().optional(),
      source: z.string().optional(),
      action: z.string().optional(),
    })
    .optional(),
  hiddenFields: ZResponseHiddenFieldValue.optional(),
  displayId: z.string().nullish(),
  endingId: z.string().nullish(),
});

export type TResponseUpdate = z.infer<typeof ZResponseUpdate>;
