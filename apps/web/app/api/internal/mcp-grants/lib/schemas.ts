import { z } from "zod";
import { MAX_MCP_GRANT_SELECTIONS, MAX_MCP_GRANT_SELECTION_ID_LENGTH } from "@/modules/mcp/grant";

/** `PATCH /api/internal/mcp-grants/{clientId}` path: an OAuth client id, as Better Auth issues them. */
export const ZMcpGrantPathParams = z.object({ clientId: z.string().min(1).max(255) }).strict();

/** A grant's selected ids, bounded at the boundary (CODING_STANDARDS "Input Limits"). */
const ZSelectionIds = z
  .array(z.string().min(1).max(MAX_MCP_GRANT_SELECTION_ID_LENGTH))
  .max(MAX_MCP_GRANT_SELECTIONS);

/**
 * `PATCH /api/internal/mcp-grants/{clientId}` body: the grant's permissions, `{ <permission>: "read" |
 * "write" }`, replacing the current ones, and optionally its organization & workspace access
 * (`access`: `all`, `organizations` with `organizationIds`, or `workspaces` with `workspaceIds`), which
 * otherwise stays as it is. Only the shape and the selection bound are checked here; the grant itself is
 * read by the operation with the consent screen's own parser (`parseRequestedMcpGrant`), so a refusal can
 * carry the code the screens translate. `expectedUpdatedAt` is the `grantUpdatedAt` Edit opened: a grant
 * saved since is not overwritten (409).
 */
export const ZMcpGrantUpdateBody = z
  .object({
    permissions: z.record(z.string(), z.unknown()),
    access: z.string().optional(),
    organizationIds: ZSelectionIds.optional(),
    workspaceIds: ZSelectionIds.optional(),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .strict();
