/**
 * GET /api/v3/unify-feedback/taxonomy/fields — the taxonomy-capable fields for a feedback directory,
 * with per-scope text/embedding counts. Feeds the source/field selectors and the gate math. Session-only.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3TaxonomyFields } from "../lib/operations";
import { ZWorkspaceDirectoryQuery } from "../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: {
    query: ZWorkspaceDirectoryQuery,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3TaxonomyFields({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      directoryId: parsedInput.query.directoryId,
      requestId,
      instance,
    }),
});
