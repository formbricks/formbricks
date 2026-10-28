import type { TV3DocumentAdapter } from "@/app/api/v3/documents/lib/envelope";
import { problemBadRequest } from "@/app/api/v3/lib/response";

// Placeholder until the workflow adapter lands: answers a clear error instead of pretending to work.
const notAvailable = async ({ requestId, instance }: { requestId: string; instance?: string }) =>
  problemBadRequest(requestId, "workflow documents are not available yet", { instance });

export const workflowDocumentAdapter: TV3DocumentAdapter = {
  kind: "workflow",
  targetType: "workflow",
  pull: notAvailable,
  push: notAvailable,
};
