/**
 * GET /api/internal/embedded-data-fields?workspaceId=…&datasetId=… — the Embedded Data fields a Feedback
 * Dataset's charts can group and filter by (ENG-2848), for the chart builder's field pickers.
 *
 * Internal surface (ENG-6583): the chart builder is the only caller and the shape exists to fill its
 * pickers, so it has no OpenAPI entry and no compatibility promise. Session-only.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listInternalEmbeddedDataFields } from "../charts/lib/operations";
import { ZInternalMatrixQuestionsQuery } from "../charts/lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZInternalMatrixQuestionsQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listInternalEmbeddedDataFields({ query: parsedInput.query, authentication, requestId, instance }),
});
