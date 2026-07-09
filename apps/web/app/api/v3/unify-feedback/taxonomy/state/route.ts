/**
 * GET /api/v3/unify-feedback/taxonomy/state — the active taxonomy tree + recent runs for a field scope.
 * Session-only.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getV3TaxonomyState } from "../lib/operations";
import { ZTaxonomyStateQuery } from "../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: {
    query: ZTaxonomyStateQuery,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3TaxonomyState({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      directoryId: parsedInput.query.directoryId,
      scopeType: parsedInput.query.scopeType,
      sourceType: parsedInput.query.sourceType,
      sourceId: parsedInput.query.sourceId,
      fieldId: parsedInput.query.fieldId,
      requestId,
      instance,
    }),
});
