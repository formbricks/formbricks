import type { TAuthorizedMcpClient } from "@/modules/mcp/authorized-clients";
import type { TMcpGrantAccessSelection, TMcpGrantPermissions } from "@/modules/mcp/grant";
import type { TMcpGrantAccessOptions } from "@/modules/mcp/grant-access";
import { type TStoredMcpGrant, getMcpGrantAccessSelection } from "@/modules/mcp/grant-store";

/** An authorized MCP client as Authorized apps reads it: dates as ISO strings. */
export type TAuthorizedMcpClientResource = Omit<TAuthorizedMcpClient, "connectedAt" | "updatedAt"> & {
  connectedAt: string;
  updatedAt: string;
};

export type TAuthorizedMcpClientList = {
  /** A Dashboard viewer's editor shows Dashboards alone, and every cap is already a viewer's. */
  isDashboardViewer: boolean;
  /** The organizations and workspaces Edit's access picker offers (ENG-7153). */
  accessOptions: TMcpGrantAccessOptions;
  clients: TAuthorizedMcpClientResource[];
};

export type TMcpGrantResource = {
  clientId: string;
  permissions: TMcpGrantPermissions;
  /** The organization & workspace access with what it selects. */
  access: TMcpGrantAccessSelection;
};

export const serializeAuthorizedMcpClient = (client: TAuthorizedMcpClient): TAuthorizedMcpClientResource => ({
  clientId: client.clientId,
  clientName: client.clientName,
  clientUri: client.clientUri,
  connectedAt: client.connectedAt.toISOString(),
  updatedAt: client.updatedAt.toISOString(),
  permissions: client.permissions,
  access: client.access,
  cap: client.cap,
});

export const serializeMcpGrant = (grant: TStoredMcpGrant): TMcpGrantResource => ({
  clientId: grant.clientId,
  permissions: grant.permissions,
  access: getMcpGrantAccessSelection(grant),
});
