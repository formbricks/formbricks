import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { checkAuthenticationAndAccess } from "@/modules/api/v2/organizations/project-teams/lib/utils";
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
  projectTeamUpdateSchema,
} from "./types/project-teams";

export async function GET(request: Request) {
  return authenticatedApiClient({
    request,
    schemas: {
      query: ZGetProjectTeamsFilter.sourceType(),
    },
    handler: async ({ parsedInput: { query }, authentication }) => {
      if (!authentication.organizationId) {
        return handleApiError(request, { type: "unauthorized" });
      }

      const result = await getProjectTeams(authentication.organizationId, query!);

      if (!result.ok) {
        return handleApiError(request, result.error);
      }

      return responses.successResponse(result);
    },
  });
}

export async function POST(request: Request) {
  return authenticatedApiClient({
    request,
    schemas: {
      body: ZProjectTeamInput,
    },
    handler: async ({ parsedInput: { body }, authentication }) => {
      const { teamId, projectId } = body!;

      const hasAccess = await checkAuthenticationAndAccess(teamId, projectId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error);
      }

      const result = await createProjectTeam(body!);
      if (!result.ok) {
        return handleApiError(request, result.error);
      }

      return responses.successResponse({ data: result.data, cors: true });
    },
  });
}

export async function PUT(request: Request) {
  return authenticatedApiClient({
    request,
    schemas: {
      body: projectTeamUpdateSchema,
      query: ZGetProjectTeamUpdateFilter,
    },
    handler: async ({ parsedInput: { query, body }, authentication }) => {
      const { teamId, projectId } = query!;

      const hasAccess = await checkAuthenticationAndAccess(teamId, projectId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error);
      }

      const result = await updateProjectTeam(teamId, projectId, body!);
      if (!result.ok) {
        return handleApiError(request, result.error);
      }

      return responses.successResponse({ data: result.data, cors: true });
    },
  });
}

export async function DELETE(request: Request) {
  return authenticatedApiClient({
    request,
    schemas: {
      query: ZGetProjectTeamUpdateFilter,
    },
    handler: async ({ parsedInput: { query }, authentication }) => {
      const { teamId, projectId } = query!;

      const hasAccess = await checkAuthenticationAndAccess(teamId, projectId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error);
      }

      const result = await deleteProjectTeam(teamId, projectId);
      if (!result.ok) {
        return handleApiError(request, result.error);
      }

      return responses.successResponse({ data: result.data, cors: true });
    },
  });
}
