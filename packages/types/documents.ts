import { z } from "zod";
import { ZId } from "./environment";

export const ZDocument = z.object({
  id: ZId,
  createdAt: z.date(),
  updatedAt: z.date(),
  documentGroupId: ZId.nullable(),
  responseId: ZId.nullable(),
  questionId: ZId.nullable(),
  text: z.string(),
  vector: z.array(z.number()).length(512),
});

export type TDocument = z.infer<typeof ZDocument>;

export const ZDocumentCreateInput = z.object({
  responseId: ZId.optional(),
  questionId: ZId.optional(),
  text: z.string(),
});

export type TDocumentCreateInput = z.infer<typeof ZDocumentCreateInput>;
