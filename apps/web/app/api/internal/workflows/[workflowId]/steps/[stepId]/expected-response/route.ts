/**
 * PUT /api/internal/workflows/{workflowId}/steps/{stepId}/expected-response — sets an HTTP request
 * step's expected response (ADR 0054): the body its API answers with, which the step's Variables and a
 * Test run's "Wait and use it" read. Only editors set it; a Test request never does. Write access.
 *
 * Internal (CODING_STANDARDS "API Design"): only the editor calls it, so it is session-only, with no
 * OpenAPI entry and no stability promise.
 */
import { ZSetWorkflowExpectedResponseInput, ZWorkflowTestRequestParams } from "@formbricks/workflows";
import { setWorkflowExpectedResponse } from "@/app/api/internal/workflows/lib/expected-response";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";

export const PUT = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZWorkflowTestRequestParams, body: ZSetWorkflowExpectedResponseInput },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    setWorkflowExpectedResponse({
      authentication,
      requestId,
      instance,
      params: parsedInput.params,
      input: parsedInput.body,
    }),
});
