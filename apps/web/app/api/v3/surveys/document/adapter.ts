import type { TV3DocumentAdapter } from "@/app/api/v3/documents/lib/envelope";
import { problemBadRequest } from "@/app/api/v3/lib/response";

// Placeholder until the survey adapter lands: answers a clear error instead of pretending to work.
const notAvailable = async ({ requestId, instance }: { requestId: string; instance?: string }) =>
  problemBadRequest(requestId, "survey documents are not available yet", { instance });

export const surveyDocumentAdapter: TV3DocumentAdapter = {
  kind: "survey",
  targetType: "survey",
  pull: notAvailable,
  push: notAvailable,
};
