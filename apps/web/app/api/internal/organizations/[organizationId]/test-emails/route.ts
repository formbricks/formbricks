import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../schemas";
import { sendTestEmailOperation } from "./lib/operations";

/** `POST /api/internal/organizations/{organizationId}/test-emails`: email the caller a customization preview. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    sendTestEmailOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
    }),
});
