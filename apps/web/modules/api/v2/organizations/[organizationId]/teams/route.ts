import { NextRequest } from "next/server";
import { z } from "zod";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { hasOrganizationIdAndAccess } from "@/modules/api/v2/organizations/[organizationId]/lib/utils";
import { createTeam, getTeams } from "@/modules/api/v2/organizations/[organizationId]/teams/lib/teams";
import {
  ZGetTeamsFilter,
  ZTeamInput,
} from "@/modules/api/v2/organizations/[organizationId]/teams/types/teams";
import { ZOrganizationIdSchema } from "@/modules/api/v2/organizations/[organizationId]/types/organizations";
import {
  canManageOrganizationUsers,
  getApiKeyCreatorRole,
} from "@/modules/api/v2/organizations/[organizationId]/users/lib/utils";

export const GET = async (request: NextRequest, props: { params: Promise<{ organizationId: string }> }) =>
  authenticatedApiClient({
    request,
    allowOrganizationOnlyApiKey: true,
    schemas: {
      query: ZGetTeamsFilter,
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput: { query, params } }) => {
      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Read)) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const res = await getTeams(authentication.organizationId, query!);

      if (!res.ok) {
        return handleApiError(request, res.error);
      }

      return responses.successResponse(res.data);
    },
  });

export const POST = async (request: Request, props: { params: Promise<{ organizationId: string }> }) =>
  authenticatedApiClient({
    request,
    allowOrganizationOnlyApiKey: true,
    schemas: {
      body: ZTeamInput,
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput: { body, params }, auditLog }) => {
      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Write)) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "organizationId", issue: "unauthorized" }],
          },
          auditLog
        );
      }

      // Org API keys carry no role of their own, so anchor authorization to the API key creator's
      // role, mirroring the same clamp enforced on user creation. Without this, a key whose creator
      // was demoted or removed could still create/rename teams even though it can no longer manage users.
      const assignerRole = await getApiKeyCreatorRole(authentication.apiKeyId, authentication.organizationId);
      if (!canManageOrganizationUsers(assignerRole)) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [{ field: "team", issue: "You are not allowed to manage teams in this organization" }],
          },
          auditLog
        );
      }

      const createTeamResult = await createTeam(body!, authentication.organizationId);
      if (!createTeamResult.ok) {
        return handleApiError(request, createTeamResult.error, auditLog);
      }

      if (auditLog) {
        auditLog.targetId = createTeamResult.data.id;
        auditLog.newObject = createTeamResult.data;
      }

      return responses.createdResponse({ data: createTeamResult.data });
    },
    action: "created",
    targetType: "team",
  });
