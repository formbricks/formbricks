import { MCP_GRANT_SUBJECT_TYPE, MCP_REACH_PERMISSION } from "@/lib/authzed/relationship-map";
import { isPermissionMissingFromSchema } from "./schema-drift";

/**
 * How `can()` and the list lookups ask SpiceDB what an MCP grant reaches (ENG-7153, ADR-0042): the
 * grant's `mcp_reach` on a resource, with the grant as the subject. Shared so both paths ask the same
 * question and fall back the same way.
 */

/** The grant as the subject of an `mcp_reach` check or lookup. */
export const toMcpGrantSubject = (grantId: string) =>
  ({ objectId: grantId, objectType: MCP_GRANT_SUBJECT_TYPE }) as const;

/**
 * Whether `error` is the previous release's schema lacking `mcp_reach`. Callers then treat the grant as
 * reaching nothing (a denied check, an empty list), never everything, until the schema is applied.
 */
export const isMcpReachMissingFromSchema = (error: unknown): boolean =>
  isPermissionMissingFromSchema(error, MCP_REACH_PERMISSION);
