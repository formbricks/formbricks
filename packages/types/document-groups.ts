import { z } from "zod";
import { ZId } from "./environment";

export const ZDocumentGroup = z.object({
  id: ZId,
  createdAt: z.date(),
  updatedAt: z.date(),
  environmentId: ZId,
  text: z.string(),
  vector: z.array(z.number()).length(512),
});

export type TDocumentGroup = z.infer<typeof ZDocumentGroup>;

export const ZDocumentGroupCreateInput = z.object({
  environmentId: ZId,
  text: z.string(),
});

export type TDocumentGroupCreateInput = z.infer<typeof ZDocumentGroupCreateInput>;
