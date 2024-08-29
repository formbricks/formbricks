import { z } from "zod";
import { ZId } from "./environment";

export const ZDocumentSentiment = z.enum(["positive", "negative", "neutral"]);

export type TDocumentSentiment = z.infer<typeof ZDocumentSentiment>;

export const ZDocument = z.object({
  id: ZId,
  createdAt: z.date(),
  updatedAt: z.date(),
  environmentId: ZId,
  responseId: ZId.nullable(),
  questionId: ZId.nullable(),
  sentiment: ZDocumentSentiment,
  text: z.string(),
  vector: z.array(z.number()).length(512),
});

export type TDocument = z.infer<typeof ZDocument>;

export const ZDocumentCreateInput = z.object({
  environmentId: ZId,
  surveyId: ZId,
  responseId: ZId,
  questionId: ZId,
  text: z.string(),
});

export type TDocumentCreateInput = z.infer<typeof ZDocumentCreateInput>;
