import "server-only";
import { requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getTeamsByOrganizationId } from "@/modules/ee/teams/team-list/lib/team";
import { serializeTeamOption } from "../serializers";

/**
 * `GET /api/internal/teams?organizationId=`: the organization's teams, for assigning a new workspace to
 * them. Owners and managers, who are the ones who can create a workspace.
 */
export async function listTeamsOperation({
  authentication,
  organizationId,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  organizationId: string;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  const access = await requireOrgActionAccess({
    authentication,
    organizationId,
    action: "organization.manage",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const teams = (await getTeamsByOrganizationId(access.organizationId)) ?? [];
  return successResponse(teams.map(serializeTeamOption), { requestId });
}
