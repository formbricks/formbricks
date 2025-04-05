import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { NextRequest } from "next/server";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    handler: async ({ authentication }) => {
      return responses.successResponse({
        data: {
          environmentPermissions: authentication.environmentPermissions.map((permission) => ({
            environmentId: permission.environmentId,
            environmentType: permission.environmentType,
            permissions: permission.permission,
            projectId: permission.projectId,
            projectName: permission.projectName,
          })),
          organizationId: authentication.organizationId,
          organizationAccess: authentication.organizationAccess,
        },
      });
    },
  });
