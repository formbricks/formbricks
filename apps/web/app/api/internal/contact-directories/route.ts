import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createContactDirectoryOperation, listContactDirectoriesOperation } from "./lib/operations";
import { ZContactDirectoriesQuery, ZContactDirectoryCreateBody } from "./schemas";

/**
 * `GET /api/internal/contact-directories?organizationId=`: the organization's contact directories and its
 * workspaces, for Organization settings › Contact directories (ENG-7497). Internal (session-only, no
 * OpenAPI entry, spec decision 17); owners and managers only. Reads aren't audited.
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZContactDirectoriesQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listContactDirectoriesOperation({ authentication, query: parsedInput.query, requestId, instance }),
});

/** `POST /api/internal/contact-directories?organizationId=`: create a directory and move workspaces into it. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZContactDirectoriesQuery, body: ZContactDirectoryCreateBody },
  action: "created",
  targetType: "contactDirectory",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createContactDirectoryOperation({
      authentication,
      query: parsedInput.query,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
