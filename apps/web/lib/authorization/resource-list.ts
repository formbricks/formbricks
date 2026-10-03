import "server-only";
import { performance } from "node:perf_hooks";
import { cache as reactCache } from "react";
import { getAuthzedClient } from "@/lib/authzed/client";
import { assertAuthzedProjectionFreshness } from "@/lib/authzed/outbox-freshness";
import { getAuthorizationSurface, recordAuthorizationCheckIssued } from "./context";
import type { TAuthorizationAction, TAuthorizationActor } from "./contract";
import { recordAuthorizationDecision } from "./metrics";
import { getSpicedbObjectType } from "./object-type";
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
      await assertAuthzedProjectionFreshness();

      const result = await getAuthzedClient().lookupResources({
        permission,
        resourceType: getSpicedbObjectType(resourceType),
        subject: {
          objectId: actorId,
          objectType: getSpicedbObjectType(actorType),
        },
      });

      recordAuthorizationDecision({
        ...metric,
        durationMs: performance.now() - startedAt,
        // For a list operation, an empty authorized set is the aggregate equivalent of a deny.
        outcome: result.resourceIds.length > 0 ? "allow" : "deny",
      });
      return result.resourceIds;
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

/**
 * ENG-3282: of the survey IDs a list page is about to return, the ones the graph also lets `actor`
 * read — one `CheckBulkPermissions` call per page. Defence in depth behind the SQL visibility
 * predicate, never a replacement for it: filtering here alone would break `limit` and the counts.
 */
export const filterReadableSurveyIds = async (
  actor: TAuthorizationActor,
  surveyIds: ReadonlyArray<string>
): Promise<ReadonlySet<string>> => {
  if (surveyIds.length === 0) return new Set();

  recordAuthorizationCheckIssued();
  const startedAt = performance.now();
  const metric = {
    action: "survey.read",
    actorType: actor.type,
    resourceType: "survey",
    surface: getAuthorizationSurface(),
  } as const;

  try {
    await assertAuthzedProjectionFreshness();
    const allowed = await getAuthzedClient().checkBulkPermissions({
      permission: "read",
      resourceIds: surveyIds,
      resourceType: getSpicedbObjectType("survey"),
      subject: { objectId: actor.id, objectType: getSpicedbObjectType(actor.type) },
    });
    recordAuthorizationDecision({
      ...metric,
      durationMs: performance.now() - startedAt,
      outcome: allowed.size > 0 ? "allow" : "deny",
    });
    return allowed;
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
};
