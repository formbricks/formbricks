import { z } from "zod";

import { ZId } from "./environment";
import { ZPerson, ZPersonAttributes } from "./people";
import { ZSurvey } from "./surveys";
import { ZTag } from "./tags";

export const ZResponseData = z.record(z.union([z.string(), z.number(), z.array(z.string())]));

export type TResponseData = z.infer<typeof ZResponseData>;

export const ZResponseTtc = z.record(z.number());

export type TResponseTtc = z.infer<typeof ZResponseTtc>;

export const ZResponsePersonAttributes = ZPersonAttributes.nullable();

export type TResponsePersonAttributes = z.infer<typeof ZResponsePersonAttributes>;

export const ZFilterCriteria = z.object({
  finished: z.boolean().optional(),
  createdAt: z
    .object({
      min: z.date().optional(),
      max: z.date().optional(),
    })
    .optional(),
  data: z
    .record(
      z.object({
        op: z.enum([
          "submitted",
          "skipped",
          "equals",
          "notEquals",
          "lessThan",
          "lessEqual",
          "greaterThan",
          "greaterEqual",
          "clicked",
          "accepted",
          "includesAll",
          "includesOne",
          "uploaded",
          "notUploaded",
          "booked",
        ]),
        value: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
      })
    )
    .superRefine((arg, ctx) => {
      const quesIds = Object.keys(arg);
      quesIds.forEach((quesId) => {
        switch (arg[quesId].op) {
          case "equals":
          case "booked":
          case "clicked":
          case "skipped":
          case "uploaded":
          case "accepted":
          case "submitted":
          case "notEquals":
          case "notUploaded":
            break;
          case "lessThan":
          case "lessEqual":
          case "greaterThan":
          case "greaterEqual":
            if (typeof arg[quesId].value !== "number") {
              ctx.addIssue({
                code: z.ZodIssueCode.invalid_type,
                expected: "number",
                received: typeof arg[quesId].value,
                path: [quesId, "value"],
                message: `Expected number for ${arg[quesId].op}`,
              });
            }
            break;
          case "includesOne":
          case "includesAll":
            if (!Array.isArray(arg[quesId].value)) {
              ctx.addIssue({
                code: z.ZodIssueCode.invalid_type,
                expected: "array",
                received: typeof arg[quesId].value,
                path: [quesId, "value"],
                message: `Expected array for ${arg[quesId].op}`,
              });
            }
            break;
        }
      });
    })
    .optional(),

  tags: z
    .object({
      applied: z.array(ZId).optional(),
      notApplied: z.array(ZId).optional(),
    })
    .optional(),
});

export type TFilterCriteria = z.infer<typeof ZFilterCriteria>;

export const ZResponseNoteUser = z.object({
  id: z.string().cuid2(),
  name: z.string().nullable(),
});

export type TResponseNoteUser = z.infer<typeof ZResponseNoteUser>;

export const ZResponseNote = z.object({
  updatedAt: z.date(),
  createdAt: z.date(),
  id: z.string(),
  text: z.string(),
  user: ZResponseNoteUser,
  isResolved: z.boolean(),
  isEdited: z.boolean(),
});

export type TResponseNote = z.infer<typeof ZResponseNote>;

export const ZResponseMeta = z.object({
  source: z.string().optional(),
  url: z.string().optional(),
  userAgent: z
    .object({
      browser: z.string().optional(),
      os: z.string().optional(),
      device: z.string().optional(),
    })
    .optional(),
});

export type TResponseMeta = z.infer<typeof ZResponseMeta>;

export const ZResponse = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  surveyId: z.string().cuid2(),
  person: ZPerson.nullable(),
  personAttributes: ZResponsePersonAttributes,
  finished: z.boolean(),
  data: ZResponseData,
  ttc: ZResponseTtc.optional(),
  notes: z.array(ZResponseNote),
  tags: z.array(ZTag),
  meta: ZResponseMeta.nullable(),
  singleUseId: z.string().nullable(),
});

export type TResponse = z.infer<typeof ZResponse>;

export const ZResponseInput = z.object({
  environmentId: z.string().cuid2(),
  surveyId: z.string().cuid2(),
  userId: z.string().nullish(),
  singleUseId: z.string().nullable().optional(),
  finished: z.boolean(),
  data: ZResponseData,
  ttc: ZResponseTtc.optional(),
  meta: z
    .object({
      source: z.string().optional(),
      url: z.string().optional(),
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

export const ZResponseLegacyInput = ZResponseInput.omit({ userId: true, environmentId: true }).extend({
  personId: z.string().cuid2().nullable(),
});

export type TResponseLegacyInput = z.infer<typeof ZResponseLegacyInput>;

export const ZResponseUpdateInput = z.object({
  finished: z.boolean(),
  data: ZResponseData,
  ttc: ZResponseTtc.optional(),
});

export type TResponseUpdateInput = z.infer<typeof ZResponseUpdateInput>;

export const ZResponseWithSurvey = ZResponse.extend({
  survey: ZSurvey,
});

export type TResponseWithSurvey = z.infer<typeof ZResponseWithSurvey>;

export const ZResponseUpdate = z.object({
  finished: z.boolean(),
  data: ZResponseData,
  ttc: ZResponseTtc.optional(),
  meta: z
    .object({
      url: z.string().optional(),
      source: z.string().optional(),
    })
    .optional(),
});

export type TResponseUpdate = z.infer<typeof ZResponseUpdate>;
