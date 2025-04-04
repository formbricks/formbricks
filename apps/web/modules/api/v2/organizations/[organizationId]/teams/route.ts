import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { hasOrganizationIdAndAccess } from "@/modules/api/v2/organizations/[organizationId]/lib/utils";
import { createTeam, getTeams } from "@/modules/api/v2/organizations/[organizationId]/teams/lib/teams";
import {
  ZGetTeamsFilter,
  ZTeamInput,
} from "@/modules/api/v2/organizations/[organizationId]/teams/types/teams";
import { organizationIdSchema } from "@/modules/api/v2/organizations/[organizationId]/types/organizations";
import { NextRequest } from "next/server";
import { z } from "zod";
import { OrganizationAccessType } from "@formbricks/types/api-key";

export const GET = async (request: NextRequest, props: { params: Promise<{ organizationId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      query: ZGetTeamsFilter.sourceType(),
      params: z.object({ organizationId: organizationIdSchema }),
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
    schemas: {
      body: ZTeamInput,
      params: z.object({ organizationId: organizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput: { body, params } }) => {
      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Write)) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const createTeamResult = await createTeam(body!, authentication.organizationId);
      if (!createTeamResult.ok) {
        return handleApiError(request, createTeamResult.error);
      }

      return responses.successResponse({ data: createTeamResult.data, cors: true });
    },
  });
