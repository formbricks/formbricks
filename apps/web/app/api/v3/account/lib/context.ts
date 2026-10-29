import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemUnauthorized, successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { isOrganizationManagerRole } from "@/app/api/v3/organizations/lib/access";
import { getOrganizationCreationPolicy } from "@/app/api/v3/organizations/lib/creation-policy";
import { type TAuthorizationActor } from "@/lib/authorization";
import {
  lookupAuthorizedOrganizationIds,
  lookupAuthorizedWorkspaceIds,
} from "@/lib/authorization/resource-list";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { andVisibleSurveys, buildVisibleSurveyWhere } from "@/lib/survey/visibility/predicate";
import { getOrganizationWorkspacesLimit } from "@/modules/ee/license-check/lib/utils";
import type { TV3AccountContext, TV3AccountOrganization } from "./schemas";

/**
 * An organization's workspaces are bounded by its plan; this only stops a pathological one pulling a table.
 * It caps EACH organization's list, so one large organization cannot starve another. Counts are never taken
 * from the capped list: they come from their own queries, and `workspacesTruncated` says when a list is cut.
 */
const MAX_WORKSPACES_PER_ORGANIZATION = 500;

type TOrganizationSeed = { id: string; name: string; role: TOrganizationRole | null };

type TWorkspaceRow = {
  id: string;
  name: string;
  appSetupCompleted: boolean;
  logo: { url?: string | null } | null;
  styling: { brandColor?: { light?: string | null } | null } | null;
};

type TOrganizationRow = {
  id: string;
  /** Workspaces the caller may reach, counted in the database, not from the capped list below. */
  _count: { workspaces: number };
  workspaces: TWorkspaceRow[];
};

/**
 * Who is asking, in the terms the visibility predicate needs, from the role already read. An organization
 * owner or manager is exactly who `organization.manage` admits (the account context's own `canManage`), so
 * this spares one authorization check per organization that `resolveSurveyActorContext` would make.
 */
const surveyActorContextFor = (
  actor: TAuthorizationActor,
  role: TOrganizationRole | null
): TSurveyActorContext =>
  actor.type === "apiKey"
    ? { enforced: true, kind: "apiKey" }
    : {
        enforced: true,
        kind: "user",
        userId: actor.id,
        isOrganizationAdmin: isOrganizationManagerRole(role),
      };

/**
 * Surveys per workspace for ALL of the caller's workspaces in one `groupBy`, through the same visibility
 * predicate every survey list applies. Organizations that share a predicate (every one the person manages,
 * every one they only belong to) share one clause, so the query stays a single round trip however many
 * organizations there are.
 */
const countVisibleSurveys = async (
  actor: TAuthorizationActor,
  seeds: TOrganizationSeed[],
  workspaceIds: string[]
): Promise<Map<string, number>> => {
  if (workspaceIds.length === 0 || seeds.length === 0) return new Map();

  const clauses = new Map<string, { context: TSurveyActorContext; organizationIds: string[] }>();
  for (const seed of seeds) {
    const context = surveyActorContextFor(actor, seed.role);
    const key = context.kind === "user" && context.isOrganizationAdmin ? "admin" : "shared";
    const clause = clauses.get(key) ?? { context, organizationIds: [] };
    clause.organizationIds.push(seed.id);
    clauses.set(key, clause);
  }

  const groups = await prisma.survey.groupBy({
    by: ["workspaceId"],
    where: {
      workspaceId: { in: workspaceIds },
      OR: [...clauses.values()].map(({ context, organizationIds }) => ({
        workspace: { organizationId: { in: organizationIds } },
        ...andVisibleSurveys(buildVisibleSurveyWhere(context)),
      })),
    },
    _count: { _all: true },
  });

  return new Map(groups.map((group) => [group.workspaceId, group._count._all]));
};

/** Pending invites per organization, only for the organizations the caller manages. One grouped query. */
const countPendingInvites = async (organizationIds: string[]): Promise<Map<string, number>> => {
  if (organizationIds.length === 0) return new Map();

  const groups = await prisma.invite.groupBy({
    by: ["organizationId"],
    where: { organizationId: { in: organizationIds }, expiresAt: { gt: new Date() } },
    _count: { _all: true },
  });

  return new Map(groups.map((group) => [group.organizationId, group._count._all]));
};

/** The plan's workspace limit once per distinct organization the caller manages, never per workspace. */
const lookupWorkspaceLimits = async (organizationIds: string[]): Promise<Map<string, number>> =>
  new Map(
    await Promise.all(
      organizationIds.map(async (id) => [id, await getOrganizationWorkspacesLimit(id)] as const)
    )
  );

/** Each organization with its capped workspace list and the real count of workspaces the caller reaches. */
export const loadOrganizationWorkspaces = async (
  organizationIds: string[],
  workspaceIds: string[],
  perOrganizationCap: number = MAX_WORKSPACES_PER_ORGANIZATION
): Promise<Map<string, TOrganizationRow>> => {
  if (workspaceIds.length === 0) return new Map();

  const authorized = { id: { in: workspaceIds } };
  const rows: TOrganizationRow[] = await prisma.organization.findMany({
    where: { id: { in: organizationIds } },
    select: {
      id: true,
      _count: { select: { workspaces: { where: authorized } } },
      // `take` on a nested relation is applied per organization.
      workspaces: {
        where: authorized,
        select: { id: true, name: true, appSetupCompleted: true, logo: true, styling: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: perOrganizationCap,
      },
    },
  });

  return new Map(rows.map((row) => [row.id, row]));
};

const buildOrganization = (
  seed: TOrganizationSeed,
  row: TOrganizationRow | undefined,
  facts: {
    surveyCounts: Map<string, number>;
    pendingInvites: Map<string, number>;
    workspaceLimits: Map<string, number>;
  }
): TV3AccountOrganization => {
  const manager = isOrganizationManagerRole(seed.role);
  const workspaces = row?.workspaces ?? [];
  const workspaceCount = row?._count.workspaces ?? 0;

  return {
    id: seed.id,
    name: seed.name,
    role: seed.role,
    canManage: manager,
    canCreateWorkspace: manager && workspaceCount < (facts.workspaceLimits.get(seed.id) ?? 0),
    pendingInviteCount: manager ? (facts.pendingInvites.get(seed.id) ?? 0) : null,
    workspaceCount,
    workspacesTruncated: workspaceCount > workspaces.length,
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      surveyCount: facts.surveyCounts.get(workspace.id) ?? 0,
      appSetupCompleted: workspace.appSetupCompleted,
      branding: {
        logoSet: Boolean(workspace.logo?.url),
        brandColor: workspace.styling?.brandColor?.light ?? null,
      },
    })),
  };
};

/** The organizations the principal belongs to, with the role the principal holds in each. */
const resolveOrganizationSeeds = async (
  authentication: NonNullable<TV3Authentication>,
  actor: TAuthorizationActor
): Promise<{ seeds: TOrganizationSeed[]; user: TV3AccountContext["user"] }> => {
  if (actor.type === "apiKey") {
    const organizationId = "organizationId" in authentication ? authentication.organizationId : null;
    const organization = organizationId
      ? await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, name: true },
        })
      : null;
    return { seeds: organization ? [{ ...organization, role: null }] : [], user: null };
  }

  const authorizedOrganizationIds = await lookupAuthorizedOrganizationIds(actor);
  const [user, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: actor.id }, select: { id: true, name: true, email: true } }),
    prisma.membership.findMany({
      where: { userId: actor.id, accepted: true, organizationId: { in: [...authorizedOrganizationIds] } },
      select: { role: true, organization: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    seeds: memberships
      .map((membership) => ({ ...membership.organization, role: membership.role }))
      .toSorted((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    user,
  };
};

/**
 * `get_account_context`: what an agent can learn about the person — who they are, their role in each
 * organization, the organizations and workspaces they can reach, and the setup facts derived from them.
 * Nothing is stored for setup progress: every field is read from existing data, so a guide that calls
 * this is safe to rerun and an organization with no workspace is simply an empty `workspaces` list.
 *
 * Read from the caller's own memberships or key grants, never from client input, so there is no id to
 * swap. Survey counts go through the survey visibility predicate: a restricted survey is not countable by
 * someone who cannot see it.
 */
export async function getV3AccountContext({
  authentication,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
}): Promise<Response> {
  const actor = getV3AuthorizationActor(authentication);
  if (!authentication || !actor) {
    return problemUnauthorized(requestId, "Not authenticated", instance);
  }

  const log = logger.withContext({ requestId });

  try {
    const { seeds, user } = await resolveOrganizationSeeds(authentication, actor);
    const organizationIds = seeds.map((seed) => seed.id);
    const managedIds = seeds.filter((seed) => isOrganizationManagerRole(seed.role)).map((seed) => seed.id);

    const workspaceIds = organizationIds.length === 0 ? [] : [...(await lookupAuthorizedWorkspaceIds(actor))];

    // Every fact below is one query for the whole account, however many organizations it has.
    const [organizationRows, surveyCounts, pendingInvites, workspaceLimits, canCreateOrganization] =
      await Promise.all([
        loadOrganizationWorkspaces(organizationIds, workspaceIds),
        countVisibleSurveys(actor, seeds, workspaceIds),
        countPendingInvites(managedIds),
        lookupWorkspaceLimits(managedIds),
        // Only a signed-in person can create an organization; an API key is never offered it.
        actor.type === "user" ? getOrganizationCreationPolicy().then((policy) => policy.allowed) : false,
      ]);

    const organizations = seeds.map((seed) =>
      buildOrganization(seed, organizationRows.get(seed.id), {
        surveyCounts,
        pendingInvites,
        workspaceLimits,
      })
    );

    const context: TV3AccountContext = {
      principal: actor.type,
      canCreateOrganization,
      user: user ? { id: user.id, name: user.name, email: user.email } : null,
      organizations,
      setup: {
        organizationCount: organizations.length,
        workspaceCount: organizations.reduce((total, organization) => total + organization.workspaceCount, 0),
        // Every visible survey in every reachable workspace, not just the listed ones.
        surveyCount: [...surveyCounts.values()].reduce((total, count) => total + count, 0),
      },
    };

    return successResponse(context, { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "account.context" });
  }
}
