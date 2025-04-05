import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { NextRequest } from "next/server";
import { OrganizationAccessType } from "@formbricks/types/api-key";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    handler: async ({ authentication }) => {
      if (!authentication.organizationAccess?.accessControl?.[OrganizationAccessType.Read]) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

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
