import "server-only";
import { cache as reactCache } from "react";
import { getAuthzedClient } from "@/lib/authzed/client";
import { assertAuthzedProjectionFreshness } from "@/lib/authzed/outbox-freshness";
import { recordAuthorizationCheckIssued } from "./context";
import type { TAuthorizationActor } from "./contract";
import { getSpicedbObjectType } from "./object-type";

type TCurrentListResource = "organization" | "workspace";
type TCurrentListPermission = "read" | "write";

const lookupAuthorizationResourceIds = reactCache(
  async (
    actorType: TAuthorizationActor["type"],
    actorId: string,
    resourceType: TCurrentListResource,
    permission: TCurrentListPermission
  ): Promise<ReadonlyArray<string>> => {
    recordAuthorizationCheckIssued();
    await assertAuthzedProjectionFreshness();

    const result = await getAuthzedClient().lookupResources({
      permission,
      resourceType: getSpicedbObjectType(resourceType),
      subject: {
        objectId: actorId,
        objectType: getSpicedbObjectType(actorType),
      },
    });

    return result.resourceIds;
  }
);

export const lookupAuthorizedOrganizationIds = (actor: TAuthorizationActor): Promise<ReadonlyArray<string>> =>
  lookupAuthorizationResourceIds(actor.type, actor.id, "organization", "read");

export const lookupAuthorizedWorkspaceIds = (
  actor: TAuthorizationActor,
  permission: TCurrentListPermission = "read"
): Promise<ReadonlyArray<string>> =>
  lookupAuthorizationResourceIds(actor.type, actor.id, "workspace", permission);
