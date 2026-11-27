import { queryOptions } from "@tanstack/react-query";
import type { TOrganizationOptionResource } from "@/app/api/internal/organizations/serializers";
import { getApiData } from "@/modules/api/lib/internal-api-client";

export const organizationListKeys = {
  all: ["organizations"] as const,
  /** The caller's own organizations: one list per session, so it takes no parameters. */
  list: () => [...organizationListKeys.all, "list"] as const,
};

/** The organizations the caller belongs to, as id and name, in no particular order. */
export const organizationListQueryOptions = () =>
  queryOptions({
    queryKey: organizationListKeys.list(),
    queryFn: ({ signal }) =>
      getApiData<TOrganizationOptionResource[]>("/api/internal/organizations", { signal }),
  });
