import { z } from "zod";
import { ZPersonAttributes } from "./people";

export const ZResponseData = z.record(z.union([z.string(), z.number(), z.array(z.string())]));

export type TResponseData = z.infer<typeof ZResponseData>;

export const ZResponsePersonAttributes = ZPersonAttributes.optional();

export type TResponsePersonAttributes = z.infer<typeof ZResponsePersonAttributes>;

const ZResponse = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  surveyId: z.string().cuid2(),
  person: z
    .object({
      id: z.string().cuid2(),
      attributes: z.record(z.union([z.string(), z.number()])),
    })
    .nullable(),
  personAttributes: ZResponsePersonAttributes,
  finished: z.boolean(),
  data: ZResponseData,
});

export type TResponse = z.infer<typeof ZResponse>;

export const ZResponseInput = z.object({
  surveyId: z.string().cuid2(),
  personId: z.string().cuid2().nullable(),
  finished: z.boolean(),
  data: ZResponseData,
});

export type TResponseInput = z.infer<typeof ZResponseInput>;

export const ZResponseUpdateInput = z.object({
  finished: z.boolean(),
  data: ZResponseData,
});

export type TResponseUpdateInput = z.infer<typeof ZResponseUpdateInput>;
