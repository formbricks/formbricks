import { z } from "zod";
import { parseRequestedMcpGrant } from "@/modules/mcp/grant";

/** `PATCH /api/internal/mcp-grants/{clientId}` path: an OAuth client id, as Better Auth issues them. */
export const ZMcpGrantPathParams = z.object({ clientId: z.string().min(1).max(255) }).strict();

/**
 * `PATCH /api/internal/mcp-grants/{clientId}` body: the grant's permissions, `{ <permission>: "read" |
 * "write" }`, replacing the current ones, and optionally its organization & workspace access
 * (`access`: `all`, `organizations` with `organizationIds`, or `workspaces` with `workspaceIds`), which
 * otherwise stays as it is. Read with the consent screen's own parser, so an unknown permission, a level
 * the permission doesn't offer, an empty grant (Revoke ends access) and a selection with nothing picked
 * are refused.
 */
export const ZMcpGrantUpdateBody = z
  .object({
    permissions: z.record(z.string(), z.unknown()),
    access: z.string().optional(),
    organizationIds: z.array(z.string()).optional(),
    workspaceIds: z.array(z.string()).optional(),
  })
  .strict()
  .transform((body, ctx) => {
    const grant = parseRequestedMcpGrant(
      Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined))
    );
    if (!grant) {
      ctx.addIssue({
        code: "custom",
        path: ["permissions"],
        message:
          "Give at least one permission, each at a level it offers, and pick at least one organization or workspace when access selects them",
      });
      return z.NEVER;
    }
    return grant;
  });
