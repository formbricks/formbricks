import { z } from "zod";

import { ZPerson, ZPersonAttributes } from "./people";
import {
  ZSurvey,
  ZSurveyCTAQuestion,
  ZSurveyCalQuestion,
  ZSurveyConsentQuestion,
  ZSurveyDateQuestion,
  ZSurveyFileUploadQuestion,
  ZSurveyLogicCondition,
  ZSurveyMultipleChoiceMultiQuestion,
  ZSurveyMultipleChoiceSingleQuestion,
  ZSurveyNPSQuestion,
  ZSurveyOpenTextQuestion,
  ZSurveyPictureSelectionQuestion,
  ZSurveyRatingQuestion,
} from "./surveys";
import { ZTag } from "./tags";

export const ZResponseData = z.record(z.union([z.string(), z.number(), z.array(z.string())]));

export type TResponseData = z.infer<typeof ZResponseData>;

export const ZResponseTtc = z.record(z.number());

export type TResponseTtc = z.infer<typeof ZResponseTtc>;

export const ZResponsePersonAttributes = ZPersonAttributes.nullable();

export type TResponsePersonAttributes = z.infer<typeof ZResponsePersonAttributes>;

export const ZSurveyPersonAttributes = z.record(z.array(z.string()));

export type TSurveyPersonAttributes = z.infer<typeof ZSurveyPersonAttributes>;

const ZResponseFilterCriteriaDataLessThan = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.lessThan),
  value: z.number(),
});

const ZResponseFilterCriteriaDataLessEqual = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.lessEqual),
  value: z.number(),
});

const ZResponseFilterCriteriaDataGreaterEqual = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.greaterEqual),
  value: z.number(),
});

const ZResponseFilterCriteriaDataGreaterThan = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.greaterThan),
  value: z.number(),
});

const ZResponseFilterCriteriaDataIncludesOne = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.includesOne),
  value: z.array(z.string()),
});

const ZResponseFilterCriteriaDataIncludesAll = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.includesAll),
  value: z.array(z.string()),
});

const ZResponseFilterCriteriaDataEquals = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.equals),
  value: z.union([z.string(), z.number()]),
});

const ZResponseFilterCriteriaDataNotEquals = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.notEquals),
  value: z.union([z.string(), z.number()]),
});

const ZResponseFilterCriteriaDataAccepted = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.accepted),
});

const ZResponseFilterCriteriaDataClicked = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.clicked),
});

const ZResponseFilterCriteriaDataSubmitted = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.submitted),
});

const ZResponseFilterCriteriaDataSkipped = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.skipped),
});

const ZResponseFilterCriteriaDataUploaded = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.uploaded),
});

const ZResponseFilterCriteriaDataNotUploaded = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.notUploaded),
});

const ZResponseFilterCriteriaDataBooked = z.object({
  op: z.literal(ZSurveyLogicCondition.Values.booked),
});

export const ZResponseFilterCriteria = z.object({
  finished: z.boolean().optional(),
  createdAt: z
    .object({
      min: z.date().optional(),
      max: z.date().optional(),
    })
    .optional(),

  personAttributes: z
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
      ])
    )
    .optional(),

  tags: z
    .object({
      applied: z.array(z.string()).optional(),
      notApplied: z.array(z.string()).optional(),
    })
    .optional(),
});

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
      country: z.string().optional(),
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

export const ZSurveySummaryOpenText = z.object({
  type: z.literal("openText"),
  question: ZSurveyOpenTextQuestion,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.string(),
      person: ZPerson.nullable(),
    })
  ),
});

export type TSurveySummaryOpenText = z.infer<typeof ZSurveySummaryOpenText>;

export const ZSurveySummaryMultipleChoice = z.object({
  type: z.union([z.literal("multipleChoiceMulti"), z.literal("multipleChoiceSingle")]),
  question: z.union([ZSurveyMultipleChoiceSingleQuestion, ZSurveyMultipleChoiceMultiQuestion]),
  responseCount: z.number(),
  choices: z.array(
    z.object({
      value: z.string(),
      count: z.number(),
      percentage: z.number(),
      others: z
        .array(
          z.object({
            value: z.string(),
            person: ZPerson.nullable(),
          })
        )
        .optional(),
    })
  ),
});

export type TSurveySummaryMultipleChoice = z.infer<typeof ZSurveySummaryMultipleChoice>;

export const ZSurveySummaryPictureSelection = z.object({
  type: z.literal("pictureSelection"),
  question: ZSurveyPictureSelectionQuestion,
  responseCount: z.number(),
  choices: z.array(
    z.object({
      id: z.string(),
      imageUrl: z.string(),
      count: z.number(),
      percentage: z.number(),
    })
  ),
});

export type TSurveySummaryPictureSelection = z.infer<typeof ZSurveySummaryPictureSelection>;

export const ZSurveySummaryRating = z.object({
  type: z.literal("rating"),
  question: ZSurveyRatingQuestion,
  responseCount: z.number(),
  average: z.number(),
  choices: z.array(
    z.object({
      rating: z.number(),
      count: z.number(),
      percentage: z.number(),
    })
  ),
  dismissed: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
});

export type TSurveySummaryRating = z.infer<typeof ZSurveySummaryRating>;

export const ZSurveySummaryNps = z.object({
  type: z.literal("nps"),
  question: ZSurveyNPSQuestion,
  responseCount: z.number(),
  total: z.number(),
  score: z.number(),
  promoters: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
  passives: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
  detractors: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
  dismissed: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
});

export type TSurveySummaryNps = z.infer<typeof ZSurveySummaryNps>;

export const ZSurveySummaryCta = z.object({
  type: z.literal("cta"),
  question: ZSurveyCTAQuestion,
  responseCount: z.number(),
  ctr: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
});

export type TSurveySummaryCta = z.infer<typeof ZSurveySummaryCta>;

export const ZSurveySummaryConsent = z.object({
  type: z.literal("consent"),
  question: ZSurveyConsentQuestion,
  responseCount: z.number(),
  accepted: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
  dismissed: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
});

export type TSurveySummaryConsent = z.infer<typeof ZSurveySummaryConsent>;

export const ZSurveySummaryDate = z.object({
  type: z.literal("date"),
  question: ZSurveyDateQuestion,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.string(),
      person: ZPerson.nullable(),
    })
  ),
});

export type TSurveySummaryDate = z.infer<typeof ZSurveySummaryDate>;

export const ZSurveySummaryFileUpload = z.object({
  type: z.literal("fileUpload"),
  question: ZSurveyFileUploadQuestion,
  responseCount: z.number(),
  files: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.array(z.string()),
      person: ZPerson.nullable(),
    })
  ),
});

export type TSurveySummaryFileUpload = z.infer<typeof ZSurveySummaryFileUpload>;

export const ZSurveySummaryCal = z.object({
  type: z.literal("cal"),
  question: ZSurveyCalQuestion,
  responseCount: z.number(),
  booked: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
  skipped: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
});

export type TSurveySummaryCal = z.infer<typeof ZSurveySummaryCal>;

export const ZSurveySummaryHiddenField = z.object({
  type: z.literal("hiddenField"),
  question: z.string(),
  responseCount: z.number(),
  samples: z.array(
    z.object({
      updatedAt: z.date(),
      value: z.string(),
      person: ZPerson.nullable(),
    })
  ),
});

export type TSurveySummaryHiddenField = z.infer<typeof ZSurveySummaryHiddenField>;

export const ZSurveySummary = z.object({
  meta: z.object({
    displayCount: z.number(),
    totalResponses: z.number(),
    startsPercentage: z.number(),
    completedResponses: z.number(),
    completedPercentage: z.number(),
    dropOffCount: z.number(),
    dropOffPercentage: z.number(),
    ttcAverage: z.number(),
  }),
  dropOff: z.array(
    z.object({
      questionId: z.string().cuid2(),
      headline: z.string(),
      ttc: z.number(),
      views: z.number(),
      dropOffCount: z.number(),
      dropOffPercentage: z.number(),
    })
  ),
  summary: z.array(
    z.union([
      ZSurveySummaryOpenText,
      ZSurveySummaryMultipleChoice,
      ZSurveySummaryPictureSelection,
      ZSurveySummaryRating,
      ZSurveySummaryNps,
      ZSurveySummaryCta,
      ZSurveySummaryConsent,
      ZSurveySummaryDate,
      ZSurveySummaryFileUpload,
      ZSurveySummaryCal,
      ZSurveySummaryHiddenField,
    ])
  ),
});

export type TSurveySummary = z.infer<typeof ZSurveySummary>;
