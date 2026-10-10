import { CheckFailure } from "./diagnostics.ts";

interface TWorkspacePermission {
  workspaceId: string;
  permissions: string;
}

const WRITE_LEVELS = new Set(["write", "manage"]);

/** Picks the one workspace an organization API key can write to, from `GET /api/v2/me`. */
export const pickWritableWorkspace = (me: unknown): string => {
  const data = (me as { data?: { workspacePermissions?: TWorkspacePermission[] } } | null)?.data;
  const writable = (data?.workspacePermissions ?? []).filter((entry) => WRITE_LEVELS.has(entry.permissions));

  if (writable.length === 1) {
    return writable[0].workspaceId;
  }
  if (writable.length === 0) {
    throw new CheckFailure(
      "API key",
      "key has no write access to any workspace",
      "create the key with write access to the deployment-check workspace"
    );
  }
  throw new CheckFailure(
    "API key",
    `key can write to ${writable.length} workspaces and the check would not know which one to use`,
    "set FORMBRICKS_WORKSPACE_ID, or scope the key to the deployment-check workspace only"
  );
};
