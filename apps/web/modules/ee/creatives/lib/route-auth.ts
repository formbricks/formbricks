import "server-only";
import { notFound } from "next/navigation";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import type { TWorkspaceAuth } from "@/modules/workspaces/types/workspace-auth";
import { getCreativesAccess } from "./access";
import type { TCreativesAccess } from "./access-rules";

export type TCreativesRouteAuth = TWorkspaceAuth & {
  creativesAccess: Exclude<TCreativesAccess, "none">;
};

/**
 * The gate for the Creatives pages, as `getWorkflowsRouteAuth` is for Workflows. `getWorkspaceAuth`
 * sends billing members to billing and refuses anyone without access to the workspace; a workspace with
 * `none` access is a 404, with no upgrade prompt. The page gets the workspace auth plus the access level
 * and decides what `windDown` leaves enabled with `isCreativesOperationAllowed` / `canWriteCreatives`
 * (`access-rules.ts`), on top of the member's own `isReadOnly`.
 */
export const getCreativesRouteAuth = async (workspaceId: string): Promise<TCreativesRouteAuth> => {
  const auth = await getWorkspaceAuth(workspaceId);
  const creativesAccess = await getCreativesAccess({ organizationId: auth.organization.id, workspaceId });
  if (creativesAccess === "none") notFound();

  return { ...auth, creativesAccess };
};
