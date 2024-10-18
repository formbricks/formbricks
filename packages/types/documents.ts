import { z } from "zod";
import { ZId } from "./common";
import { ZSurveyQuestionId } from "./surveys/types";

export const ZDocumentSentiment = z.enum(["positive", "negative", "neutral"]);

export type TDocumentSentiment = z.infer<typeof ZDocumentSentiment>;

export const ZDocument = z.object({
  id: ZId,
  createdAt: z.date(),
  updatedAt: z.date(),
  environmentId: ZId,
  responseId: ZId.nullable(),
  questionId: ZSurveyQuestionId.nullable(),
  sentiment: ZDocumentSentiment,
  text: z.string(),
});

export type TDocument = z.infer<typeof ZDocument>;

export const ZDocumentCreateInput = z.object({
  environmentId: ZId,
  surveyId: ZId,
  responseId: ZId,
  questionId: ZSurveyQuestionId,
  text: z.string(),
});

export type TDocumentCreateInput = z.infer<typeof ZDocumentCreateInput>;

export const ZDocumentFilterCriteria = z.object({
  createdAt: z
    .object({
      min: z.date().optional(),
      max: z.date().optional(),
    })
    .optional(),
});

export type TDocumentFilterCriteria = z.infer<typeof ZDocumentFilterCriteria>;
