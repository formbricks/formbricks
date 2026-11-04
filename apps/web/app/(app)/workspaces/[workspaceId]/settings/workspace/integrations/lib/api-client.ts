import type { TIntegrationItem } from "@formbricks/types/integration";
import {
  type TIntegrationConnectionResource,
  type TIntegrationMappingsByType,
  type TIntegrationTypeParam,
  toIntegrationMappingBody,
} from "@/app/api/internal/integrations/schemas";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

/**
 * Client fetchers for the integration settings pages. An integration is addressed by workspace and type.
 * Every call throws a `V3ApiError` on a refusal; a provider read that needs the integration reconnected
 * carries the reason in `details.reason` (read it with `getV3ApiErrorReason`).
 */

const BASE_PATH = "/api/internal/integrations";

const integrationUrl = (workspaceId: string, type: TIntegrationTypeParam, suffix = "") =>
  buildApiUrl(`${BASE_PATH}/${type}${suffix}`, { workspaceId });

/**
 * Replace an integration's mappings. Only the mappings are sent: the credentials and the connected
 * account stay as the OAuth callback stored them.
 */
export const saveIntegrationMappings = <T extends TIntegrationTypeParam>(
  workspaceId: string,
  type: T,
  mappings: TIntegrationMappingsByType[T][]
): Promise<{ id: string }> =>
  sendApiRequest<{ id: string }>(integrationUrl(workspaceId, type), {
    method: "PUT",
    body: { config: { data: mappings.map((mapping) => toIntegrationMappingBody(type, mapping)) } },
  });

export const disconnectIntegration = (workspaceId: string, type: TIntegrationTypeParam) =>
  sendApiRequest<void>(integrationUrl(workspaceId, type), { method: "DELETE" });

/** Whether the workspace's Google Sheets grant still works. */
export const getGoogleSheetsConnection = async (workspaceId: string) =>
  (
    await getApiData<TIntegrationConnectionResource>(
      integrationUrl(workspaceId, "googleSheets", "/connection")
    )
  ).status;

/** A spreadsheet's name, read with the workspace's Google Sheets grant. */
export const getSpreadsheet = (workspaceId: string, spreadsheetId: string) =>
  getApiData<{ id: string; name: string }>(
    integrationUrl(workspaceId, "googleSheets", `/spreadsheets/${encodeURIComponent(spreadsheetId)}`)
  );

/** The Slack channels a mapping can post to. */
export const getSlackChannels = (workspaceId: string) =>
  getApiData<TIntegrationItem[]>(integrationUrl(workspaceId, "slack", "/channels"));
