import { z } from "zod";
import { ZId } from "./environment";

export const ZDocumentType = z.enum(["questionResponse"]);

export type TDocumentType = z.infer<typeof ZDocumentType>;

export const ZDocument = z.object({
  environmentId: ZId,
  referenceId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  type: ZDocumentType,
  text: z.string(),
  vector: z.array(z.number()).length(512),
});

export type TDocument = z.infer<typeof ZDocument>;

export const ZDocumentCreateInput = z.object({
  environmentId: ZId,
  type: ZDocumentType,
  referenceId: z.string(),
  text: z.string(),
  vector: z.array(z.number()).length(512),
});

export type TDocumentCreateInput = z.infer<typeof ZDocumentCreateInput>;
