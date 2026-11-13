import type { AuthInfo } from "@modelcontextprotocol/server";
import { type TMcpAuthInfo, getMcpAuthentication } from "../auth";
import { mcpGrantAllows } from "../grant";
import { type TMcpPermissionRequirement, getMcpPermissionScope } from "../permissions";

/**
 * Whether the caller holds `requirement` by both halves of the tool gate (`guard-permissions.ts`): the
 * token's scope, and the grant (an API key has none, and is gated on its scopes alone). Not a gate: for a
 * tool that returns some data only to a caller that may read it, such as `get_workflow_run`'s
 * respondent-derived fields, rather than refusing the whole call.
 */
export const mcpCallerHolds = (
  authInfo: AuthInfo | undefined,
  requirement: TMcpPermissionRequirement
): boolean => {
  if (!(authInfo?.scopes ?? []).includes(getMcpPermissionScope(requirement))) return false;
  const authentication = getMcpAuthentication(authInfo);
  if (authentication && "apiKeyId" in authentication) return true;
  const grant = (authInfo as TMcpAuthInfo | undefined)?.extra?.grant;
  return grant ? mcpGrantAllows(grant, requirement) : false;
};
