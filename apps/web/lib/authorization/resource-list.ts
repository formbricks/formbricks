import "server-only";
import { performance } from "node:perf_hooks";
import { cache as reactCache } from "react";
import { logger } from "@formbricks/logger";
import { getAuthzedClient } from "@/lib/authzed/client";
import { AUTHZED_MAX_BULK_CHECK_ITEMS } from "@/lib/authzed/constants";
import { assertAuthzedProjectionFreshness } from "@/lib/authzed/outbox-freshness";
import { MCP_REACH_PERMISSION } from "@/lib/authzed/relationship-map";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import {
  getAuthorizationSurface,
  getMcpGrantForActor,
  recordAuthorizationCheckIssued,
  recordMcpReachDenied,
} from "./context";
import type { TAuthorizationAction, TAuthorizationActor } from "./contract";
import { isMcpReachMissingFromSchema, toMcpGrantSubject } from "./mcp-reach";
import { recordAuthorizationDecision } from "./metrics";
import { getSpicedbObjectType } from "./object-type";
import { normalizeAuthorizationOperationalError } from "./operational-error";
import { isPermissionMissingFromSchema } from "./schema-drift";

/** `dashboard` (ADR-0059): the dashboards the actor reads, a Dashboard Viewer's team limits applied. */
type TCurrentListResource = "dashboard" | "organization" | "workspace";
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
  const within = held.filter((id) => reached.has(id));
  if (within.length < held.length) recordMcpReachDenied();
  return within;
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
 * ADR-0059: every dashboard `actor` can open, across all workspaces — `LookupResources` of
 * `dashboard#read`, so a Dashboard Viewer's team dashboard limits apply. Only projected dashboards are
 * listed: a dashboard created a moment ago appears once the outbox has delivered it. Callers intersect
 * the result with the dashboards PostgreSQL holds for the workspace they list.
 */
export const lookupReadableDashboardIds = (actor: TAuthorizationActor): Promise<ReadonlyArray<string>> =>
  withinMcpGrant(
    actor,
    "dashboard",
    lookupAuthorizationResourceIds(actor.type, actor.id, "dashboard", "read")
  );

/**
 * Of the grant's reach, the pages it reaches: `dashboard_page#mcp_reach`, the reach of the page's
 * dashboard's workspace. `null` when no grant limits the request.
 */
const filterPagesWithinMcpGrant = async (
  actor: TAuthorizationActor,
  pageIds: ReadonlyArray<string>
): Promise<ReadonlySet<string> | null> => {
  const grant = getMcpGrantForActor(actor);
  if (!grant) return null;
  try {
    return await getAuthzedClient().checkBulkPermissions({
      permission: MCP_REACH_PERMISSION,
      resourceIds: pageIds,
      resourceType: "dashboard_page",
      subject: toMcpGrantSubject(grant.id),
    });
  } catch (error) {
    if (isMcpReachMissingFromSchema(error)) return new Set();
    throw error;
  }
};

/**
 * ADR-0059: of `pageIds`, the dashboard pages `actor` can open — `CheckBulkPermissions` of
 * `dashboard_page#read` in batches of at most `AUTHZED_MAX_BULK_CHECK_ITEMS`, so a page's team limit
 * applies to a Dashboard Viewer. Unprojected pages are denied (fail closed).
 */
export const filterReadableDashboardPageIds = async (
  actor: TAuthorizationActor,
  pageIds: ReadonlyArray<string>
): Promise<ReadonlySet<string>> => {
  const ids = [...new Set(pageIds)];
  if (ids.length === 0) return new Set();

  recordAuthorizationCheckIssued();
  const startedAt = performance.now();
  const metric = {
    action: "dashboardPage.read",
    actorType: actor.type,
    resourceType: "dashboardPage",
    surface: getAuthorizationSurface(),
  } as const;

  try {
    await assertAuthzedProjectionFreshness();
    const allowed = new Set<string>();
    for (let start = 0; start < ids.length; start += AUTHZED_MAX_BULK_CHECK_ITEMS) {
      const batch = ids.slice(start, start + AUTHZED_MAX_BULK_CHECK_ITEMS);
      // Bounded batches, one round trip each, in order.
      const [readable, reached] = await Promise.all([
        // NOSONAR
        getAuthzedClient().checkBulkPermissions({
          permission: "read",
          resourceIds: batch,
          resourceType: getSpicedbObjectType("dashboardPage"),
          subject: { objectId: actor.id, objectType: getSpicedbObjectType(actor.type) },
        }),
        filterPagesWithinMcpGrant(actor, batch),
      ]);
      for (const id of readable) {
        if (reached === null || reached.has(id)) allowed.add(id);
      }
      if (reached !== null && [...readable].some((id) => !reached.has(id))) recordMcpReachDenied();
    }
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
