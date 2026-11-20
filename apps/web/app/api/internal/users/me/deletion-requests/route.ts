import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requestAccountDeletionOperation } from "../lib/operations";

/** `POST /api/internal/users/me/deletion-requests`: email an SSO account the link that confirms deleting it. */
export const POST = withV3ApiWrapper({
  auth: "session",
  handler: async ({ authentication, requestId, instance }) =>
    requestAccountDeletionOperation({ authentication, requestId, instance }),
});
