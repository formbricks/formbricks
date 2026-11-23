import { queryOptions } from "@tanstack/react-query";
import type { TTeamOptionResource } from "@/app/api/internal/teams/serializers";
import { buildApiUrl, getApiData } from "@/modules/api/lib/internal-api-client";

export const organizationTeamKeys = {
  all: ["organization-teams"] as const,
  list: (organizationId: string) => [...organizationTeamKeys.all, "list", organizationId] as const,
};

/** The organization's teams, to assign a new workspace to. */
export const organizationTeamsQueryOptions = (organizationId: string) =>
  queryOptions({
    queryKey: organizationTeamKeys.list(organizationId),
    queryFn: ({ signal }) =>
      getApiData<TTeamOptionResource[]>(buildApiUrl("/api/internal/teams", { organizationId }), { signal }),
  });
