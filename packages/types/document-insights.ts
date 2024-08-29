import { z } from "zod";
import { ZId } from "./common";

export const ZDocumentInsight = z.object({
  documentId: ZId,
  insightId: ZId,
});

export type TDocumentInsight = z.infer<typeof ZDocumentInsight>;
