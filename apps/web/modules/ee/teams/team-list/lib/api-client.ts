import type { TTeamCreateBody, TTeamUpdateBody } from "@/app/api/internal/teams/schemas";
import type { TTeamResource, TTeamWithCurrentUserRoleResource } from "@/app/api/internal/teams/serializers";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

const BASE_PATH = "/api/internal/teams";

const teamPath = (teamId: string) => `${BASE_PATH}/${encodeURIComponent(teamId)}`;

/** Create a team in the organization. Returns the new team. */
export const createTeam = ({ organizationId, body }: { organizationId: string; body: TTeamCreateBody }) =>
  sendApiRequest<TTeamResource>(buildApiUrl(BASE_PATH, { organizationId }), { method: "POST", body });

/** The team for its settings modal, with the current user's role in it. */
export const getTeam = (teamId: string, { signal }: { signal?: AbortSignal } = {}) =>
  getApiData<TTeamWithCurrentUserRoleResource>(teamPath(teamId), { signal });

/** Rename the team and replace its members and workspace grants. Returns the team as stored. */
export const updateTeam = ({ teamId, body }: { teamId: string; body: TTeamUpdateBody }) =>
  sendApiRequest<TTeamResource>(teamPath(teamId), { method: "PATCH", body });

export const deleteTeam = (teamId: string) => sendApiRequest<void>(teamPath(teamId), { method: "DELETE" });
