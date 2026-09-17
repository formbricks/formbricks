import "server-only";
import { performance } from "node:perf_hooks";
import { cache as reactCache } from "react";
import { lookupBridgeResourceIds } from "./bridge-access";
import { getAuthorizationSurface, recordAuthorizationCheckIssued } from "./context";
import type { TAuthorizationAction, TAuthorizationActor } from "./contract";
import { recordAuthorizationDecision } from "./metrics";
import { normalizeAuthorizationOperationalError } from "./operational-error";

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
    const startedAt = performance.now();
    const action = `${resourceType}.${permission}` as TAuthorizationAction;
    const metric = {
      action,
      actorType,
      resourceType,
      surface: getAuthorizationSurface(),
    } as const;

    try {
      const resourceIds = await lookupBridgeResourceIds(
        { type: actorType, id: actorId },
        resourceType,
        permission
      );

      recordAuthorizationDecision({
        ...metric,
        durationMs: performance.now() - startedAt,
        // For a list operation, an empty authorized set is the aggregate equivalent of a deny.
        outcome: resourceIds.length > 0 ? "allow" : "deny",
      });
      return resourceIds;
    } catch (error) {
      const normalized = normalizeAuthorizationOperationalError(error, "authorization_list");
      recordAuthorizationDecision({
        ...metric,
        durationMs: performance.now() - startedAt,
        errorCode: normalized.code,
        outcome: "operational_error",
      });
      throw normalized;
    }
  }
);

export const lookupAuthorizedOrganizationIds = (actor: TAuthorizationActor): Promise<ReadonlyArray<string>> =>
  lookupAuthorizationResourceIds(actor.type, actor.id, "organization", "read");

export const lookupAuthorizedWorkspaceIds = (
  actor: TAuthorizationActor,
  permission: TCurrentListPermission = "read"
): Promise<ReadonlyArray<string>> =>
  lookupAuthorizationResourceIds(actor.type, actor.id, "workspace", permission);
