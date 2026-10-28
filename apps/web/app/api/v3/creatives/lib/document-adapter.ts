import type { TV3DocumentAdapter } from "@/app/api/v3/documents/lib/envelope";
import { problemBadRequest } from "@/app/api/v3/lib/response";

// Placeholder until the creative adapter lands: answers a clear error instead of pretending to work.
const notAvailable = async ({ requestId, instance }: { requestId: string; instance?: string }) =>
  problemBadRequest(requestId, "creative documents are not available yet", { instance });

export const creativeDocumentAdapter: TV3DocumentAdapter = {
  kind: "creative",
  targetType: "creative",
  pull: notAvailable,
  push: notAvailable,
};
