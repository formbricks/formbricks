/**
 * /api/v3/contacts/attribute-values - distinct values of one contact attribute in a workspace, for
 * quick-filter value pickers. Session cookie or x-api-key; scope by workspaceId only. Contacts-entitlement
 * gated.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3ContactAttributeValues } from "./lib/operations";
import { ZV3ContactAttributeValuesQuery } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: {
    query: ZV3ContactAttributeValuesQuery,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) => {
    return await listV3ContactAttributeValues({
      query: parsedInput.query,
      authentication,
      requestId,
      instance,
    });
  },
});
