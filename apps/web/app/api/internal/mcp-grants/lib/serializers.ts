import type { TMcpConnection } from "@/modules/mcp/connections";
import type { TMcpGrantAccess, TMcpGrantPermissions } from "@/modules/mcp/grant";
import type { TMcpGrantAccessOptions } from "@/modules/mcp/grant-access";

/** A connection as Authorized apps reads it: dates as ISO strings. */
export type TMcpConnectionResource = Omit<TMcpConnection, "connectedAt" | "updatedAt"> & {
  connectedAt: string;
  updatedAt: string;
};

export type TMcpConnectionList = {
  /** A Dashboard viewer's editor shows Dashboards alone, and every cap is already a viewer's. */
  isDashboardViewer: boolean;
  /** The organizations and workspaces Edit's access picker offers (ENG-7153). */
  accessOptions: TMcpGrantAccessOptions;
  connections: TMcpConnectionResource[];
};

export type TMcpGrantResource = {
  clientId: string;
  permissions: TMcpGrantPermissions;
  access: TMcpGrantAccess;
  organizationIds: string[];
  workspaceIds: string[];
};

export const serializeMcpConnection = (connection: TMcpConnection): TMcpConnectionResource => ({
  clientId: connection.clientId,
  clientName: connection.clientName,
  clientUri: connection.clientUri,
  consentId: connection.consentId,
  connectedAt: connection.connectedAt.toISOString(),
  updatedAt: connection.updatedAt.toISOString(),
  permissions: connection.permissions,
  access: connection.access,
  organizationIds: connection.organizationIds,
  workspaceIds: connection.workspaceIds,
  cap: connection.cap,
});

export const serializeMcpGrant = (grant: TMcpGrantResource): TMcpGrantResource => ({
  clientId: grant.clientId,
  permissions: grant.permissions,
  access: grant.access,
  organizationIds: grant.organizationIds,
  workspaceIds: grant.workspaceIds,
});
