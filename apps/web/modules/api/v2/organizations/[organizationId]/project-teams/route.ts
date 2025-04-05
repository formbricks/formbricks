import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { hasOrganizationIdAndAccess } from "@/modules/api/v2/organizations/[organizationId]/lib/utils";
import { checkAuthenticationAndAccess } from "@/modules/api/v2/organizations/[organizationId]/project-teams/lib/utils";
import { ZOrganizationIdSchema } from "@/modules/api/v2/organizations/[organizationId]/types/organizations";
import { z } from "zod";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import {
  createProjectTeam,
  deleteProjectTeam,
  getProjectTeams,
  updateProjectTeam,
} from "./lib/project-teams";
import {
  ZGetProjectTeamUpdateFilter,
  ZGetProjectTeamsFilter,
  ZProjectTeamInput,
  ZProjectZTeamUpdateSchema,
} from "./types/project-teams";

export async function GET(request: Request, props: { params: Promise<{ organizationId: string }> }) {
  return authenticatedApiClient({
    request,
    schemas: {
      query: ZGetProjectTeamsFilter.sourceType(),
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ parsedInput: { query, params }, authentication }) => {
      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Read)) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const result = await getProjectTeams(authentication.organizationId, query!);

      if (!result.ok) {
        return handleApiError(request, result.error);
      }

      return responses.successResponse(result.data);
    },
  });
}

export async function POST(request: Request, props: { params: Promise<{ organizationId: string }> }) {
  return authenticatedApiClient({
    request,
    schemas: {
      body: ZProjectTeamInput,
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ parsedInput: { body, params }, authentication }) => {
      const { teamId, projectId } = body!;

      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Write)) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const hasAccess = await checkAuthenticationAndAccess(teamId, projectId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error);
      }

      const result = await createProjectTeam(body!);
      if (!result.ok) {
        return handleApiError(request, result.error);
      }

      return responses.successResponse({ data: result.data });
    },
  });
}

export async function PUT(request: Request, props: { params: Promise<{ organizationId: string }> }) {
  return authenticatedApiClient({
    request,
    schemas: {
      body: ZProjectZTeamUpdateSchema,
      query: ZGetProjectTeamUpdateFilter,
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ parsedInput: { query, body, params }, authentication }) => {
      const { teamId, projectId } = query!;

      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Write)) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const hasAccess = await checkAuthenticationAndAccess(teamId, projectId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error);
      }

      const result = await updateProjectTeam(teamId, projectId, body!);
      if (!result.ok) {
        return handleApiError(request, result.error);
      }

      return responses.successResponse({ data: result.data });
    },
  });
}

export async function DELETE(request: Request, props: { params: Promise<{ organizationId: string }> }) {
  return authenticatedApiClient({
    request,
    schemas: {
      query: ZGetProjectTeamUpdateFilter,
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ parsedInput: { query, params }, authentication }) => {
      const { teamId, projectId } = query!;

      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Write)) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const hasAccess = await checkAuthenticationAndAccess(teamId, projectId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error);
      }

      const result = await deleteProjectTeam(teamId, projectId);
      if (!result.ok) {
        return handleApiError(request, result.error);
      }

      return responses.successResponse({ data: result.data });
    },
  });
}
