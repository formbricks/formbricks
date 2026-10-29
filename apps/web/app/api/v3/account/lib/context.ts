import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemUnauthorized, successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganizationCreationPolicy } from "@/app/api/v3/organizations/lib/creation-policy";
import { type TAuthorizationActor } from "@/lib/authorization";
import {
  lookupAuthorizedOrganizationIds,
  lookupAuthorizedWorkspaceIds,
} from "@/lib/authorization/resource-list";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { buildVisibleSurveyWhere } from "@/lib/survey/visibility/predicate";
import { getOrganizationWorkspacesLimit } from "@/modules/ee/license-check/lib/utils";
import type { TV3AccountContext, TV3AccountOrganization } from "./schemas";

/** An organization's workspaces are bounded by its plan; this only stops a pathological one pulling a table. */
const MAX_WORKSPACES = 500;

type TOrganizationSeed = { id: string; name: string; role: TOrganizationRole | null };

type TWorkspaceRow = {
  id: string;
  name: string;
  organizationId: string;
  appSetupCompleted: boolean;
  logo: { url?: string | null } | null;
  styling: { brandColor?: { light?: string | null } | null } | null;
};

const isManager = (role: TOrganizationRole | null): boolean => role === "owner" || role === "manager";

/** Surveys per workspace, through the same visibility predicate every survey list applies. */
const countVisibleSurveys = async (
  actor: TAuthorizationActor,
  organizationId: string,
  workspaceIds: string[]
): Promise<Map<string, number>> => {
  if (workspaceIds.length === 0) return new Map();

  const visible = buildVisibleSurveyWhere(await resolveSurveyActorContext(actor, organizationId));
  const groups = await prisma.survey.groupBy({
    by: ["workspaceId"],
    where: { workspaceId: { in: workspaceIds }, ...visible },
    _count: { _all: true },
  });

  return new Map(groups.map((group) => [group.workspaceId, group._count._all]));
};

const buildOrganization = async (
  actor: TAuthorizationActor,
  seed: TOrganizationSeed,
  workspaces: TWorkspaceRow[]
): Promise<TV3AccountOrganization> => {
  const manager = isManager(seed.role);
  const [surveyCounts, pendingInviteCount, workspaceLimit] = await Promise.all([
    countVisibleSurveys(
      actor,
      seed.id,
      workspaces.map((workspace) => workspace.id)
    ),
    manager
      ? prisma.invite.count({ where: { organizationId: seed.id, expiresAt: { gt: new Date() } } })
      : Promise.resolve(null),
    manager ? getOrganizationWorkspacesLimit(seed.id) : Promise.resolve(0),
  ]);

  return {
    id: seed.id,
    name: seed.name,
    role: seed.role,
    joinedAs: seed.role === null ? null : seed.role === "owner" ? "owner" : "invited",
    canManage: manager,
    canCreateWorkspace: manager && workspaces.length < workspaceLimit,
    pendingInviteCount,
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      surveyCount: surveyCounts.get(workspace.id) ?? 0,
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

    const workspaceIds = organizationIds.length === 0 ? [] : [...(await lookupAuthorizedWorkspaceIds(actor))];
    const workspaces: TWorkspaceRow[] =
      workspaceIds.length === 0
        ? []
        : await prisma.workspace.findMany({
            where: { id: { in: workspaceIds }, organizationId: { in: organizationIds } },
            select: {
              id: true,
              name: true,
              organizationId: true,
              appSetupCompleted: true,
              logo: true,
              styling: true,
            },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            take: MAX_WORKSPACES,
          });

    const [organizations, canCreateOrganization] = await Promise.all([
      Promise.all(
        seeds.map((seed) =>
          buildOrganization(
            actor,
            seed,
            workspaces.filter((workspace) => workspace.organizationId === seed.id)
          )
        )
      ),
      // Only a signed-in person can create an organization; an API key is never offered it.
      actor.type === "user" ? getOrganizationCreationPolicy().then((policy) => policy.allowed) : false,
    ]);

    const allWorkspaces = organizations.flatMap((organization) => organization.workspaces);
    const context: TV3AccountContext = {
      principal: actor.type,
      canCreateOrganization,
      user: user ? { id: user.id, name: user.name, email: user.email } : null,
      organizations,
      setup: {
        organizationCount: organizations.length,
        workspaceCount: allWorkspaces.length,
        surveyCount: allWorkspaces.reduce((total, workspace) => total + workspace.surveyCount, 0),
        brandingSet: allWorkspaces.some(
          (workspace) => workspace.branding.logoSet || workspace.branding.brandColor !== null
        ),
      },
    };

    return successResponse(context, { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "account.context" });
  }
}
