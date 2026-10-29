/**
 * POST /api/v3/organizations — create an organization the signed-in person owns (ADR 0018). It creates no
 * workspace; the response points at the Setup guide's new-owner path.
 *
 * Session cookie only: an organization belongs to a person, so an API key has no one to make owner. The
 * operation enforces the multi-organization licence rule and a per-user rate limit itself, so the MCP tool
 * and the organization switcher get the same answers.
 */
import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { createV3Organization } from "./lib/create";

export const POST = withV3ApiWrapper({
  auth: "session",
  action: "created",
  targetType: "organization",
  schemas: {
    query: ZV3EmptyQuery,
    // Parsed by the operation, so the MCP tool that calls it directly gets the same 400.
    body: z.unknown(),
  },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    createV3Organization({ body: parsedInput.body, authentication, auditLog, requestId, instance }),
});
