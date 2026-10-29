import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createOrganizationOperation, listOrganizationsOperation } from "./lib/operations";
import { ZOrganizationCreateBody, ZOrganizationsListQuery } from "./schemas";

/** `GET /api/internal/organizations`: the caller's organizations, for the organization switcher. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZOrganizationsListQuery },
  handler: async ({ authentication, requestId, instance }) =>
    listOrganizationsOperation({ authentication, requestId, instance }),
});

/** `POST /api/internal/organizations`: set up an organization (onboarding). */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { body: ZOrganizationCreateBody },
  action: "created",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createOrganizationOperation({ authentication, body: parsedInput.body, requestId, instance, auditLog }),
});
