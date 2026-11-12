import "server-only";
import { performance } from "node:perf_hooks";
import { cache as reactCache } from "react";
import { logger } from "@formbricks/logger";
import { getAuthzedClient } from "@/lib/authzed/client";
import { assertAuthzedProjectionFreshness } from "@/lib/authzed/outbox-freshness";
import { MCP_REACH_PERMISSION } from "@/lib/authzed/relationship-map";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { getAuthorizationSurface, getMcpGrantForActor, recordAuthorizationCheckIssued } from "./context";
import type { TAuthorizationAction, TAuthorizationActor } from "./contract";
import { isMcpReachMissingFromSchema, toMcpGrantSubject } from "./mcp-reach";
import { recordAuthorizationDecision } from "./metrics";
import { getSpicedbObjectType } from "./object-type";
import { normalizeAuthorizationOperationalError } from "./operational-error";
import { isPermissionMissingFromSchema } from "./schema-drift";

type TCurrentListResource = "organization" | "workspace";
/** `dashboard_read` lists the workspaces whose dashboards the actor reads, a Dashboard viewer's included. */
type TCurrentListPermission = "read" | "write" | "dashboard_read";

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
      // On the previous release's schema a permission this release adds does not exist yet: nothing is
      // listed, as a check of it is denied (see `isPermissionMissingFromSchema`).
      if (isPermissionMissingFromSchema(error, permission)) {
        logger.warn(
          { permission, resourceType },
          "AuthZed schema lacks a permission this release adds; listing nothing until the schema is applied"
        );
        recordAuthorizationDecision({
          ...metric,
          durationMs: performance.now() - startedAt,
          outcome: "deny",
        });
        return [];
      }
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

/**
 * The organizations or workspaces an MCP grant reaches (ENG-7153, ADR-0042): one `LookupResources` of
 * `mcp_reach` with the grant as subject. Cached per request like the actor's own lookup.
 */
const lookupMcpGrantReachIds = reactCache(
  async (grantId: string, resourceType: TCurrentListResource): Promise<ReadonlySet<string>> => {
    try {
      const result = await getAuthzedClient().lookupResources({
        permission: MCP_REACH_PERMISSION,
        resourceType: getSpicedbObjectType(resourceType),
        subject: toMcpGrantSubject(grantId),
      });
      return new Set(result.resourceIds);
    } catch (error) {
      // On the previous release's schema nothing is reached, exactly as a check of it is denied.
      if (isMcpReachMissingFromSchema(error)) return new Set();
      throw normalizeAuthorizationOperationalError(error, "authorization_list");
    }
  }
);

/**
 * Of the ids `actor` holds, those the request's MCP grant also reaches. A no-op without a grant that
 * limits organization & workspace access, so every other caller lists exactly as before. Two lookups
 * whatever the count, never one per id.
 */
const withinMcpGrant = async (
  actor: TAuthorizationActor,
  resourceType: TCurrentListResource,
  ids: Promise<ReadonlyArray<string>>
): Promise<ReadonlyArray<string>> => {
  const grant = getMcpGrantForActor(actor);
  if (!grant) return ids;
  const [held, reached] = await Promise.all([ids, lookupMcpGrantReachIds(grant.id, resourceType)]);
  return held.filter((id) => reached.has(id));
};

export const lookupAuthorizedOrganizationIds = (actor: TAuthorizationActor): Promise<ReadonlyArray<string>> =>
  withinMcpGrant(
    actor,
    "organization",
    lookupAuthorizationResourceIds(actor.type, actor.id, "organization", "read")
  );

export const lookupAuthorizedWorkspaceIds = (
  actor: TAuthorizationActor,
  permission: TCurrentListPermission = "read"
): Promise<ReadonlyArray<string>> =>
  withinMcpGrant(
    actor,
    "workspace",
    lookupAuthorizationResourceIds(actor.type, actor.id, "workspace", permission)
  );

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
  // Callers already applied workspace authorization and the stored SQL visibility predicate.
  if (!(await isSurveyVisibilityReady())) return new Set(surveyIds);

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
      permission: "read_v2",
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
