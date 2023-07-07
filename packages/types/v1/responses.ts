import { z } from "zod";
import { ZPersonAttributes } from "./people";
import { ZTag } from "./tags";

export const ZResponseData = z.record(z.union([z.string(), z.number(), z.array(z.string())]));

export type TResponseData = z.infer<typeof ZResponseData>;

export const ZResponsePersonAttributes = ZPersonAttributes.nullable();

export type TResponsePersonAttributes = z.infer<typeof ZResponsePersonAttributes>;

export const ZResponseNoteUser = z.object({
  id: z.string().cuid2(),
  name: z.string().nullable(),
});

export type TResponseNoteUser = z.infer<typeof ZResponseNoteUser>;

const ZResponseNote = z.object({
  updatedAt: z.date(),
  createdAt: z.date(),
  id: z.string(),
  text: z.string(),
  user: ZResponseNoteUser,
});

export type TResponseNote = z.infer<typeof ZResponseNote>;

const ZResponse = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  surveyId: z.string().cuid2(),
  person: z
    .object({
      id: z.string().cuid2(),
      attributes: z.record(z.union([z.string(), z.number()])),
      createdAt: z.date(),
      updatedAt: z.date(),
    })
    .nullable(),
  personAttributes: ZResponsePersonAttributes,
  finished: z.boolean(),
  data: ZResponseData,
  notes: z.array(ZResponseNote),
  tags: z.array(ZTag),
});

export type TResponse = z.infer<typeof ZResponse>;

export const ZResponseInput = z.object({
  surveyId: z.string().cuid2(),
  personId: z.string().cuid2().nullable(),
  finished: z.boolean(),
  data: ZResponseData,
  meta: z
    .object({
      userAgent: z
        .object({
          browser: z.string().optional(),
          device: z.string().optional(),
          os: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type TResponseInput = z.infer<typeof ZResponseInput>;

export const ZResponseUpdateInput = z.object({
  finished: z.boolean(),
  data: ZResponseData,
});

export type TResponseUpdateInput = z.infer<typeof ZResponseUpdateInput>;
