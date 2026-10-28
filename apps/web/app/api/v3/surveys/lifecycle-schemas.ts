import { z } from "zod";

/**
 * What archive and restore answer: a minimal lifecycle ack rather than the survey document, because both
 * operate on legacy question-based surveys the document serializer rejects (see `runV3SurveyLifecycleMutation`).
 * `archivedAt` is an ISO timestamp once the survey is archived and null once it is restored.
 */
export const ZV3SurveyLifecycleResource = z.object({
  id: z.string(),
  status: z.string(),
  archivedAt: z.string().nullable(),
});
