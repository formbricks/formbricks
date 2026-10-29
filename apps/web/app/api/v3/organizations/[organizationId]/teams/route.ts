/**
 * GET /api/v3/organizations/{organizationId}/teams — list the organization's teams.
 * POST /api/v3/organizations/{organizationId}/teams — create an empty team.
 *
 * Session cookie only: teams belong to people with an organization role, and an API key has none. Teams
 * are an Enterprise feature, so without the licence both answer 403. The operations enforce the role and
 * the licence themselves, so the MCP tools that call them directly get the same answers.
 */
import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { createV3Team, listV3Teams } from "@/app/api/v3/teams/lib/operations";

const organizationParamsSchema = z.object({
  organizationId: z.cuid2(),
});

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: organizationParamsSchema, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3Teams({
      organizationId: parsedInput.params.organizationId,
      authentication,
      requestId,
      instance,
    }),
});

export const POST = withV3ApiWrapper({
  auth: "session",
  action: "created",
  targetType: "team",
  schemas: {
    params: organizationParamsSchema,
    query: ZV3EmptyQuery,
    // Parsed by the operation, so the MCP tool that calls it directly gets the same 400.
    body: z.unknown(),
  },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    createV3Team({
      organizationId: parsedInput.params.organizationId,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
