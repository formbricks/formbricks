/**
 * GET /api/internal/workflows/{workflowId}/test-responses?cursor= — the trigger survey's responses of
 * a Response completed workflow, newest first, 20 a page, for the Test run picker (ADR 0049). Write
 * access only, like the Test run.
 *
 * Internal (CODING_STANDARDS "API Design"): only the editor calls it, so it is session-only, with no
 * OpenAPI entry and no stability promise. `GET /api/v3/responses` is not reused: it answers full
 * responses under read access, while the picker needs a summary row under the workflow's write access.
 */
import { z } from "zod";
import { ZWorkflowIdInput } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listWorkflowTestResponses } from "../../lib/test-responses";

const ZTestResponsesQuery = z.strictObject({ cursor: z.string().min(1).max(512).optional() });

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZWorkflowIdInput, query: ZTestResponsesQuery },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    listWorkflowTestResponses({
      authentication,
      requestId,
      instance,
      params: parsedInput.params,
      cursor: parsedInput.query.cursor ?? null,
    }),
});
