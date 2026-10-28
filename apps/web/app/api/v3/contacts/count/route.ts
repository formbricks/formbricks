/** GET /api/v3/contacts/count — how many contacts match the same filters as the list. */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { countV3Contacts } from "../lib/operations";
import { ZV3ContactCountQuery } from "../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3ContactCountQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    countV3Contacts({ query: parsedInput.query, authentication, requestId, instance }),
});
