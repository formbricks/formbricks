import { z } from "zod";
import { ZInsight } from "@formbricks/database/zod/insights";
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

export const ZGenerateDocumentObjectSchema = z.object({
  sentiment: ZDocumentSentiment,
  insights: z.array(
    z.object({
      title: z.string().describe("insight title, very specific"),
      description: z.string().describe("very brief insight description"),
      category: ZInsight.shape.category,
    })
  ),
  isSpam: z.boolean(),
});

export type TGenerateDocumentObjectSchema = z.infer<typeof ZGenerateDocumentObjectSchema>;

export type TCreatedDocument = TDocument & {
  isSpam: boolean;
  insights: TGenerateDocumentObjectSchema["insights"];
};
