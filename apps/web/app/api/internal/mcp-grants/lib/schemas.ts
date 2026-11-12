import { z } from "zod";
import { parseRequestedMcpGrant } from "@/modules/mcp/grant";

/** `PATCH /api/internal/mcp-grants/{clientId}` path: an OAuth client id, as Better Auth issues them. */
export const ZMcpGrantPathParams = z.object({ clientId: z.string().min(1).max(255) }).strict();

/**
 * `PATCH /api/internal/mcp-grants/{clientId}` body: the grant's permissions, `{ <permission>: "read" |
 * "write" }`, replacing the current ones. Read with the consent screen's own parser, so an unknown
 * permission, a level the permission doesn't offer and an empty grant (Revoke ends access) are refused.
 * Organization & workspace access is not editable here yet (ENG-7153).
 */
export const ZMcpGrantUpdateBody = z
  .object({ permissions: z.record(z.string(), z.unknown()) })
  .strict()
  .transform((body, ctx) => {
    const permissions = parseRequestedMcpGrant(body);
    if (!permissions) {
      ctx.addIssue({
        code: "custom",
        path: ["permissions"],
        message: "Give at least one permission, each at a level it offers",
      });
      return z.NEVER;
    }
    return { permissions };
  });
