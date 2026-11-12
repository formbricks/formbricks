import type { TMcpConnection } from "@/modules/mcp/connections";
import type { TMcpGrantPermissions } from "@/modules/mcp/grant";

/** A connection as Authorized apps reads it: dates as ISO strings. */
export type TMcpConnectionResource = Omit<TMcpConnection, "connectedAt" | "updatedAt"> & {
  connectedAt: string;
  updatedAt: string;
};

export type TMcpConnectionList = {
  /** A Dashboard viewer's editor shows Dashboards alone, and every cap is already a viewer's. */
  isDashboardViewer: boolean;
  connections: TMcpConnectionResource[];
};

export type TMcpGrantResource = { clientId: string; permissions: TMcpGrantPermissions };

export const serializeMcpConnection = (connection: TMcpConnection): TMcpConnectionResource => ({
  clientId: connection.clientId,
  clientName: connection.clientName,
  clientUri: connection.clientUri,
  consentId: connection.consentId,
  connectedAt: connection.connectedAt.toISOString(),
  updatedAt: connection.updatedAt.toISOString(),
  permissions: connection.permissions,
  cap: connection.cap,
});

export const serializeMcpGrant = (grant: TMcpGrantResource): TMcpGrantResource => ({
  clientId: grant.clientId,
  permissions: grant.permissions,
});
