import { z } from "zod";

export type TResponseData = Record<string, string | number | string[] | Record<string, string>>;

export type TResponseTtc = Record<string, number>;

export type TResponseVariables = Record<string, string | number>;

export type TResponseHiddenFieldValue = Record<string, string | number | string[]>;

export interface TResponseUpdate {
  finished: boolean;
  data: TResponseData;
  language?: string;
  variables?: TResponseVariables;
  ttc?: TResponseTtc;
  meta?: { url?: string; source?: string; action?: string };
  hiddenFields?: TResponseHiddenFieldValue;
  displayId?: string | null;
  endingId?: string | null;
}

export const ZResponseData = z.record(z.union([z.string(), z.number(), z.array(z.string())]));
export const ZResponseVariables = z.record(z.union([z.string(), z.number()]));
export const ZResponseTtc = z.record(z.number());
export const ZResponseHiddenFieldValue = z.record(z.union([z.string(), z.number(), z.array(z.string())]));

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
