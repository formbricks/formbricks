import { z } from "zod";

export const ZEmbeddingType = z.enum(["questionResponse"]);

export const ZEmbedding = z.object({
  referenceId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  type: ZEmbeddingType,
  vector: z.array(z.number()).length(512),
});

export type TEmbedding = z.infer<typeof ZEmbedding>;

export const ZEmbeddingCreateInput = z.object({
  type: ZEmbeddingType,
  referenceId: z.string(),
  vector: z.array(z.number()).length(512),
});

export type TEmbeddingCreateInput = z.infer<typeof ZEmbeddingCreateInput>;
