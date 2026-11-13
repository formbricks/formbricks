import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import type { TWorkspacesListQuery, ZWorkspaceCreateBody } from "@/app/api/internal/workspaces/schemas";
import type { TWorkspaceOptionResource } from "@/app/api/internal/workspaces/serializers";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

const BASE_PATH = "/api/internal/workspaces";

/** `read`: every workspace the caller can open (the switchers). `write`: those it can write to. */
export type TWorkspaceListAccess = TWorkspacesListQuery["access"];

export const workspaceListKeys = {
  all: ["workspaces"] as const,
  /** Every list of one organization's workspaces, whatever the access level: what a create invalidates. */
  organization: (organizationId: string) => [...workspaceListKeys.all, "list", organizationId] as const,
  list: (organizationId: string, access: TWorkspaceListAccess) =>
    [...workspaceListKeys.organization(organizationId), access] as const,
};

/** The caller's workspaces in the organization, as id and name, in no particular order. */
export const workspaceListQueryOptions = (organizationId: string, access: TWorkspaceListAccess = "read") =>
  queryOptions({
    queryKey: workspaceListKeys.list(organizationId, access),
    queryFn: ({ signal }) =>
      getApiData<TWorkspaceOptionResource[]>(buildApiUrl(BASE_PATH, { organizationId, access }), { signal }),
  });

/** What the create-workspace dialog sends: a name, and optionally the teams to grant the workspace to. */
export type TWorkspaceCreateInput = z.input<typeof ZWorkspaceCreateBody>;

/** Create a workspace in the organization. Answers its id and name. */
export const createWorkspace = (organizationId: string, body: TWorkspaceCreateInput) =>
  sendApiRequest<TWorkspaceOptionResource>(buildApiUrl(BASE_PATH, { organizationId }), {
    method: "POST",
    body,
  });
