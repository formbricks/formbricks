import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TViewerAccessJoin } from "./viewer-access-fields";

/**
 * Browser client for the dashboard access settings (ENG-7476, ENG-7483): a Feedback Dataset's Dashboard
 * Viewer access and a team's dashboard limits, through their v3 routes, with TanStack Query.
 */

const MUTATION_TIMEOUT_MS = 15_000;

export type TDatasetViewerAccessCondition = {
  field: string;
  fieldLabel: string;
  attributeKeyId: string | null;
  attributeLabel: string;
};

export type TDatasetViewerAccessResource = {
  datasetId: string;
  join: TViewerAccessJoin;
  conditions: TDatasetViewerAccessCondition[];
  updatedAt: string;
};

export type TTeamDashboardLimitsResource = { teamId: string; dashboardIds: string[] };

const json = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: T }).data;
};

const datasetPath = (datasetId: string) =>
  `/api/v3/feedback-datasets/${encodeURIComponent(datasetId)}/dashboard-viewer-access`;
const teamPath = (teamId: string) => `/api/v3/teams/${encodeURIComponent(teamId)}/dashboard-limits`;

export const getDatasetViewerAccess = async (
  datasetId: string,
  signal?: AbortSignal
): Promise<TDatasetViewerAccessResource> =>
  json(await fetch(datasetPath(datasetId), { cache: "no-store", signal }));

export const replaceDatasetViewerAccess = async (
  datasetId: string,
  body: {
    join: TViewerAccessJoin;
    conditions: { field: string; attributeKeyId: string | null }[];
    expectedUpdatedAt: string;
  }
): Promise<TDatasetViewerAccessResource> =>
  json(
    await fetch(datasetPath(datasetId), {
      method: "PUT",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    })
  );

export const getTeamDashboardLimits = async (
  teamId: string,
  signal?: AbortSignal
): Promise<TTeamDashboardLimitsResource> =>
  json(await fetch(teamPath(teamId), { cache: "no-store", signal }));

export const replaceTeamDashboardLimits = async (
  teamId: string,
  dashboardIds: string[]
): Promise<TTeamDashboardLimitsResource> =>
  json(
    await fetch(teamPath(teamId), {
      method: "PUT",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dashboardIds }),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    })
  );

export const dashboardAccessQueryKeys = {
  dataset: (datasetId: string) => ["dashboard-access", "dataset", datasetId] as const,
  team: (teamId: string) => ["dashboard-access", "team", teamId] as const,
};
