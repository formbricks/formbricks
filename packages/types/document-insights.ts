import { z } from "zod";
import { ZId } from "./environment";

export const ZDocumentInsight = z.object({
  documentId: ZId,
  insightId: ZId,
});

export type TDocumentInsight = z.infer<typeof ZDocumentInsight>;
