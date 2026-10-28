import "server-only";
import { cache as reactCache } from "react";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getIsCreativesEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TCreativesAccess } from "./access-rules";
import { workspaceHasCreatives } from "./repository";

// Keyed on primitives so React's request cache dedupes repeated calls (the layout, the page and the
// survey-side UI in one render) into one licence read and at most one query.
const resolveCreativesAccess = reactCache(
  async (workspaceId: string, knownOrganizationId: string | undefined): Promise<TCreativesAccess> => {
    const organizationId = knownOrganizationId ?? (await getOrganizationIdFromWorkspaceId(workspaceId));
    if (await getIsCreativesEnabled(organizationId)) return "full";
    // Cloud has never offered Creatives, so there is nothing there to wind down.
    if (IS_FORMBRICKS_CLOUD) return "none";
    return (await workspaceHasCreatives(workspaceId)) ? "windDown" : "none";
  }
);

/**
 * The one place the Creatives access level of a workspace is decided (ENG-6602); every surface (sidebar,
 * pages, API v3, MCP, survey-side UI) acts on its answer through the rules in `access-rules.ts`:
 *
 * - `full` when the licence includes Creatives (`getIsCreativesEnabled`);
 * - `windDown` when it doesn't, on a self-hosted instance whose workspace still has a creative (archived
 *   ones count, so their authors can still delete them);
 * - `none` otherwise: always on Cloud, and self-hosted without a licence and without creatives.
 *
 * Pass the organization id when it is at hand; otherwise it is looked up from the workspace. Costs one
 * licence read (cached in process) plus, only when the licence is off on a self-hosted instance, one
 * indexed `findFirst`. Delivery only needs to know whether access is `full`, which is
 * `getIsCreativesEnabled` alone, with no query.
 */
export const getCreativesAccess = (
  target: string | Readonly<{ organizationId: string; workspaceId: string }>
): Promise<TCreativesAccess> =>
  typeof target === "string"
    ? resolveCreativesAccess(target, undefined)
    : resolveCreativesAccess(target.workspaceId, target.organizationId);
