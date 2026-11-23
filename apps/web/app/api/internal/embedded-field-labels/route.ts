/**
 * PUT /api/internal/embedded-field-labels — the workspace's name for an imported (embedded-data) key,
 * shown in place of the key in every chart's legends and headers and in the chart builder's field pickers.
 *
 * Internal surface: the chart builder's rename (the ✎ on an imported field's chip) is the only caller, so it
 * has no OpenAPI entry and no compatibility promise; every other v3 convention applies. Session-only.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { putInternalEmbeddedFieldLabel } from "./lib/operations";
import { ZInternalEmbeddedFieldLabelBody } from "./lib/schemas";

export const PUT = withV3ApiWrapper({
  auth: "session",
  schemas: { body: ZInternalEmbeddedFieldLabelBody },
  action: "updated",
  targetType: "embeddedData",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    putInternalEmbeddedFieldLabel({ body: parsedInput.body, authentication, requestId, instance, auditLog }),
});
