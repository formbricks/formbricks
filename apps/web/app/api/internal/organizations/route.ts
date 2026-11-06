import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createOrganizationOperation } from "./lib/operations";
import { ZOrganizationCreateBody } from "./schemas";

/** `POST /api/internal/organizations`: set up an organization (onboarding). */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { body: ZOrganizationCreateBody },
  action: "created",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createOrganizationOperation({ authentication, body: parsedInput.body, requestId, instance, auditLog }),
});
