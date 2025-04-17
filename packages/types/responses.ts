import { z } from "zod";
import { ZId } from "./common";
import { ZSurvey } from "./surveys/types";
import { ZTag } from "./tags";

export const ZResponseDataValue = z.union([
  z.string(),
  z.number(),
  z.array(z.string()),
  z.record(z.string()),
]);

export const ZResponseFilterCondition = z.enum([
  "accepted",
  "clicked",
  "submitted",
  "skipped",
  "equals",
  "notEquals",
  "lessThan",
  "lessEqual",
  "greaterThan",
  "greaterEqual",
  "includesAll",
  "includesOne",
  "uploaded",
  "notUploaded",
  "booked",
  "isCompletelySubmitted",
  "isPartiallySubmitted",
  "is",
  "isNot",
  "isEmpty",
  "isNotEmpty",
  "isAnyOf",
]);

export type TResponseDataValue = z.infer<typeof ZResponseDataValue>;

export const ZResponseData = z.record(ZResponseDataValue);

export type TResponseData = z.infer<typeof ZResponseData>;

export const ZResponseVariables = z.record(z.union([z.string(), z.number()]));

export type TResponseVariables = z.infer<typeof ZResponseVariables>;

export const ZResponseTtc = z.record(z.number());

export type TResponseTtc = z.infer<typeof ZResponseTtc>;

export const ZResponseContactAttributes = z.record(z.string()).nullable();

export type TResponseContactAttributes = z.infer<typeof ZResponseContactAttributes>;

export const ZSurveyContactAttributes = z.record(z.array(z.string()));

export type TSurveyContactAttributes = z.infer<typeof ZSurveyContactAttributes>;

export const ZSurveyMetaFieldFilter = z.record(z.array(z.string()));

export type TSurveyMetaFieldFilter = z.infer<typeof ZSurveyMetaFieldFilter>;

export const ZResponseHiddenFieldsFilter = z.record(z.array(z.string()));

export type TResponseHiddenFieldsFilter = z.infer<typeof ZResponseHiddenFieldsFilter>;

const ZResponseFilterCriteriaDataLessThan = z.object({
  op: z.literal(ZResponseFilterCondition.Values.lessThan),
  value: z.number(),
});

const ZResponseFilterCriteriaDataLessEqual = z.object({
  op: z.literal(ZResponseFilterCondition.Values.lessEqual),
  value: z.number(),
});

const ZResponseFilterCriteriaDataGreaterEqual = z.object({
  op: z.literal(ZResponseFilterCondition.Values.greaterEqual),
  value: z.number(),
});

const ZResponseFilterCriteriaDataGreaterThan = z.object({
  op: z.literal(ZResponseFilterCondition.Values.greaterThan),
  value: z.number(),
});

const ZResponseFilterCriteriaDataIncludesOne = z.object({
  op: z.literal(ZResponseFilterCondition.Values.includesOne),
  value: z.union([z.array(z.string()), z.array(z.number())]),
});

const ZResponseFilterCriteriaDataIncludesAll = z.object({
  op: z.literal(ZResponseFilterCondition.Values.includesAll),
  value: z.array(z.string()),
});

const ZResponseFilterCriteriaDataEquals = z.object({
  op: z.literal(ZResponseFilterCondition.Values.equals),
  value: z.union([z.string(), z.number()]),
});

const ZResponseFilterCriteriaDataNotEquals = z.object({
  op: z.literal(ZResponseFilterCondition.Values.notEquals),
  value: z.union([z.string(), z.number()]),
});

const ZResponseFilterCriteriaDataAccepted = z.object({
  op: z.literal(ZResponseFilterCondition.Values.accepted),
});

const ZResponseFilterCriteriaDataClicked = z.object({
  op: z.literal(ZResponseFilterCondition.Values.clicked),
});

const ZResponseFilterCriteriaDataSubmitted = z.object({
  op: z.literal(ZResponseFilterCondition.Values.submitted),
});

const ZResponseFilterCriteriaDataSkipped = z.object({
  op: z.literal(ZResponseFilterCondition.Values.skipped),
});

const ZResponseFilterCriteriaDataUploaded = z.object({
  op: z.literal(ZResponseFilterCondition.Values.uploaded),
});

const ZResponseFilterCriteriaDataNotUploaded = z.object({
  op: z.literal(ZResponseFilterCondition.Values.notUploaded),
});

const ZResponseFilterCriteriaDataBooked = z.object({
  op: z.literal(ZResponseFilterCondition.Values.booked),
});

const ZResponseFilterCriteriaMatrix = z.object({
  op: z.literal("matrix"),
  value: z.record(z.string(), z.string()),
});

const ZResponseFilterCriteriaIs = z.object({
  op: z.literal(ZResponseFilterCondition.Values.is),
  value: z.record(z.string(), z.string()),
});

const ZResponseFilterCriteriaIsNot = z.object({
  op: z.literal(ZResponseFilterCondition.Values.isNot),
  value: z.record(z.string(), z.string()),
});

const ZResponseFilterCriteriaIsEmpty = z.object({
  op: z.literal(ZResponseFilterCondition.Values.isEmpty),
});

const ZResponseFilterCriteriaIsNotEmpty = z.object({
  op: z.literal(ZResponseFilterCondition.Values.isNotEmpty),
});

const ZResponseFilterCriteriaIsAnyOf = z.object({
  op: z.literal(ZResponseFilterCondition.Values.isAnyOf),
  value: z.record(z.string(), z.array(z.string())),
});

const ZResponseFilterCriteriaFilledOut = z.object({
  op: z.literal("filledOut"),
});

export const ZResponseFilterCriteria = z.object({
  finished: z.boolean().optional(),
  createdAt: z
    .object({
      min: z.date().optional(),
      max: z.date().optional(),
    })
    .optional(),

  contactAttributes: z
    .record(
      z.object({
        op: z.enum(["equals", "notEquals"]),
        value: z.union([z.string(), z.number()]),
      })
    )
    .optional(),

  data: z
    .record(
      z.union([
        ZResponseFilterCriteriaDataLessThan,
        ZResponseFilterCriteriaDataLessEqual,
        ZResponseFilterCriteriaDataGreaterEqual,
        ZResponseFilterCriteriaDataGreaterThan,
        ZResponseFilterCriteriaDataIncludesOne,
        ZResponseFilterCriteriaDataIncludesAll,
        ZResponseFilterCriteriaDataEquals,
        ZResponseFilterCriteriaDataNotEquals,
        ZResponseFilterCriteriaDataAccepted,
        ZResponseFilterCriteriaDataClicked,
        ZResponseFilterCriteriaDataSubmitted,
        ZResponseFilterCriteriaDataSkipped,
        ZResponseFilterCriteriaDataUploaded,
        ZResponseFilterCriteriaDataNotUploaded,
        ZResponseFilterCriteriaDataBooked,
        ZResponseFilterCriteriaMatrix,
        ZResponseFilterCriteriaIs,
        ZResponseFilterCriteriaIsNot,
        ZResponseFilterCriteriaIsEmpty,
        ZResponseFilterCriteriaIsNotEmpty,
        ZResponseFilterCriteriaIsAnyOf,
        ZResponseFilterCriteriaFilledOut,
      ])
    )
    .optional(),

  tags: z
    .object({
      applied: z.array(z.string()).optional(),
      notApplied: z.array(z.string()).optional(),
    })
    .optional(),

  others: z
    .record(
      z.object({
        op: z.enum(["equals", "notEquals"]),
        value: z.union([z.string(), z.number()]),
      })
    )
    .optional(),

  meta: z
    .record(
      z.object({
        op: z.enum(["equals", "notEquals"]),
        value: z.union([z.string(), z.number()]),
      })
    )
    .optional(),
});

export const ZResponseContact = z.object({
  id: ZId,
  userId: z.string(),
});

export type TResponseContact = z.infer<typeof ZResponseContact>;

export type TResponseFilterCriteria = z.infer<typeof ZResponseFilterCriteria>;

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
  country: z.string().optional(),
  action: z.string().optional(),
});

export type TResponseMeta = z.infer<typeof ZResponseMeta>;

export const ZResponse = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  surveyId: z.string().cuid2(),
  displayId: z.string().nullish(),
  contact: ZResponseContact.nullable(),
  contactAttributes: ZResponseContactAttributes,
  finished: z.boolean(),
  endingId: z.string().nullish(),
  data: ZResponseData,
  variables: ZResponseVariables,
  ttc: ZResponseTtc.optional(),
  notes: z.array(ZResponseNote),
  tags: z.array(ZTag),
  meta: ZResponseMeta,
  singleUseId: z.string().nullable(),
  language: z.string().nullable(),
});

export type TResponse = z.infer<typeof ZResponse>;

export const ZResponseInput = z.object({
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  environmentId: z.string().cuid2(),
  surveyId: z.string().cuid2(),
  userId: z.string().nullish(),
  displayId: z.string().nullish(),
  singleUseId: z.string().nullable().optional(),
  finished: z.boolean(),
  endingId: z.string().nullish(),
  language: z.string().optional(),
  data: ZResponseData,
  variables: ZResponseVariables.optional(),
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
      country: z.string().optional(),
      action: z.string().optional(),
    })
    .optional(),
});

export type TResponseInput = z.infer<typeof ZResponseInput>;

export const ZResponseUpdateInput = z.object({
  finished: z.boolean(),
  endingId: z.string().nullish(),
  data: ZResponseData,
  variables: ZResponseVariables.optional(),
  ttc: ZResponseTtc.optional(),
  language: z.string().optional(),
});

export type TResponseUpdateInput = z.infer<typeof ZResponseUpdateInput>;

export const ZResponseWithSurvey = ZResponse.extend({
  survey: ZSurvey,
});

export type TResponseWithSurvey = z.infer<typeof ZResponseWithSurvey>;

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

export const ZResponseTableData = z.object({
  responseId: z.string(),
  createdAt: z.date(),
  status: z.string(),
  verifiedEmail: z.string(),
  tags: z.array(ZTag),
  notes: z.array(ZResponseNote),
  language: z.string().nullable(),
  responseData: ZResponseData,
  variables: z.record(z.union([z.string(), z.number()])),
  person: ZResponseContact.nullable(),
  contactAttributes: ZResponseContactAttributes,
});

export type TResponseTableData = z.infer<typeof ZResponseTableData>;
