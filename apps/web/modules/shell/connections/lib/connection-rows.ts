import type { TOrganizationAccess } from "@formbricks/types/api-key";
import { type TAccessSummary, summarizeScopes } from "./scope-families";

export type TConnectionPermission = "read" | "write" | "manage";

export type TConnectionWorkspaces =
  | { type: "all" }
  | { type: "none" }
  | { type: "named"; items: { name: string; permission: TConnectionPermission }[] };

export type TConnectionStatus = "active" | "neverUsed";

interface TConnectionRowBase {
  id: string;
  name: string;
  access: TAccessSummary;
  workspaces: TConnectionWorkspaces;
  status: TConnectionStatus;
}

/**
 * One row of the Agent connections table. An OAuth connection is a person's consent (it acts as them,
 * and only the signed-in person's own consents are listed); an API key is owned by the organization.
 * OAuth consents record when they were approved but never when they were last used, API keys record
 * both, so the two kinds carry different dates.
 */
export type TConnectionRow =
  | (TConnectionRowBase & { kind: "oauth"; authorizedAt: Date })
  | (TConnectionRowBase & { kind: "apiKey"; createdAt: Date; lastUsedAt: Date | null });

export interface TApiKeyRecord {
  id: string;
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  organizationAccess?: TOrganizationAccess | null;
  apiKeyWorkspaces: { workspaceId: string; permission: TConnectionPermission }[];
}

export interface TOAuthConsentRecord {
  id: string;
  scopes: string[];
  createdAt: Date;
  client: { clientId: string; name: string | null } | null;
}

/**
 * The scopes an API key carries over MCP. Mirrors `getMcpScopes` in `modules/mcp/auth.ts`, which is
 * what the server actually enforces, with one refinement: that function hands out every `:read` scope
 * even to a key with no workspace, but such a key reaches no workspace data, so it would be wrong to
 * list surveys and responses as its access.
 */
export const getApiKeyScopes = ({
  workspacePermissions,
  organizationAccess,
}: {
  workspacePermissions: readonly { permission: TConnectionPermission }[];
  organizationAccess?: TOrganizationAccess | null;
}): string[] => {
  const scopes: string[] = [];

  if (workspacePermissions.length > 0) {
    scopes.push(
      "surveys:read",
      "workflows:read",
      "feedbackRecords:read",
      "responses:read",
      "contacts:read",
      "webhooks:read"
    );

    if (workspacePermissions.some(({ permission }) => permission === "write" || permission === "manage")) {
      scopes.push(
        "surveys:write",
        "workflows:write",
        "feedbackRecords:write",
        "responses:write",
        "contacts:write",
        "webhooks:write"
      );
    }
  }

  // An organization-wide record: a workspace grant, even `manage`, never reaches it.
  if (organizationAccess?.accessControl?.read === true) {
    scopes.push("audit:read");
  }

  return scopes;
};

export const mapApiKeyToRow = (
  apiKey: TApiKeyRecord,
  workspaceNames: ReadonlyMap<string, string>
): TConnectionRow => {
  const items = apiKey.apiKeyWorkspaces.flatMap(({ workspaceId, permission }) => {
    const name = workspaceNames.get(workspaceId);
    return name === undefined ? [] : [{ name, permission }];
  });

  return {
    kind: "apiKey",
    id: apiKey.id,
    name: apiKey.label,
    access: summarizeScopes(
      getApiKeyScopes({
        workspacePermissions: apiKey.apiKeyWorkspaces,
        organizationAccess: apiKey.organizationAccess,
      })
    ),
    workspaces: items.length > 0 ? { type: "named", items } : { type: "none" },
    status: apiKey.lastUsedAt ? "active" : "neverUsed",
    createdAt: apiKey.createdAt,
    lastUsedAt: apiKey.lastUsedAt,
  };
};

export const mapOAuthConsentToRow = (consent: TOAuthConsentRecord): TConnectionRow => ({
  kind: "oauth",
  id: consent.id,
  name: consent.client?.name?.trim() || consent.client?.clientId || consent.id,
  access: summarizeScopes(consent.scopes),
  // A token acts as the person who approved it, so it reaches every workspace that person can.
  workspaces: { type: "all" },
  // A consent only exists while the connection is live: revoking deletes it.
  status: "active",
  authorizedAt: consent.createdAt,
});

const getLastActivity = (row: TConnectionRow): Date => {
  if (row.kind === "oauth") return row.authorizedAt;
  return row.lastUsedAt ?? row.createdAt;
};

/** Merges both kinds into one list, most recently active first. */
export const buildConnectionRows = ({
  apiKeys,
  consents,
  workspaces,
}: {
  apiKeys: readonly TApiKeyRecord[];
  consents: readonly TOAuthConsentRecord[];
  workspaces: readonly { id: string; name: string }[];
}): TConnectionRow[] => {
  const workspaceNames = new Map(workspaces.map(({ id, name }) => [id, name]));

  return [
    ...consents.map(mapOAuthConsentToRow),
    ...apiKeys.map((key) => mapApiKeyToRow(key, workspaceNames)),
  ].sort(
    (a, b) => getLastActivity(b).getTime() - getLastActivity(a).getTime() || a.name.localeCompare(b.name)
  );
};
