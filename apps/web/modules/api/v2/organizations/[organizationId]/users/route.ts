import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { hasOrganizationIdAndAccess } from "@/modules/api/v2/organizations/[organizationId]/lib/utils";
import { ZOrganizationIdSchema } from "@/modules/api/v2/organizations/[organizationId]/types/organizations";
import {
  createUser,
  getUsers,
  updateUser,
} from "@/modules/api/v2/organizations/[organizationId]/users/lib/users";
import {
  ZGetUsersFilter,
  ZUserInput,
  ZUserInputPatch,
} from "@/modules/api/v2/organizations/[organizationId]/users/types/users";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { OrganizationAccessType } from "@formbricks/types/api-key";

export const GET = async (request: NextRequest, props: { params: Promise<{ organizationId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      query: ZGetUsersFilter.sourceType(),
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput: { query, params } }) => {
      if (IS_FORMBRICKS_CLOUD) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "organizationId", issue: "This endpoint is not supported on Formbricks Cloud" }],
        });
      }

      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Read)) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const res = await getUsers(authentication.organizationId, query!);

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
      body: ZUserInput,
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput: { body, params }, auditLog }) => {
      if (IS_FORMBRICKS_CLOUD) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [
              { field: "organizationId", issue: "This endpoint is not supported on Formbricks Cloud" },
            ],
          },
          auditLog
        );
      }

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

      const createUserResult = await createUser(body!, authentication.organizationId);
      if (!createUserResult.ok) {
        return handleApiError(request, createUserResult.error, auditLog);
      }

      if (auditLog) {
        auditLog.targetId = createUserResult.data.id;
        auditLog.newObject = createUserResult.data;
      }

      return responses.createdResponse({ data: createUserResult.data });
    },
    action: "created",
    targetType: "user",
  });

export const PATCH = async (request: Request, props: { params: Promise<{ organizationId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      body: ZUserInputPatch,
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput: { body, params }, auditLog }) => {
      if (IS_FORMBRICKS_CLOUD) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [
              { field: "organizationId", issue: "This endpoint is not supported on Formbricks Cloud" },
            ],
          },
          auditLog
        );
      }

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

      if (!body?.email) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "email", issue: "Email is required" }],
          },
          auditLog
        );
      }

      let oldUserData: any = UNKNOWN_DATA;
      try {
        const oldUserResult = await getUsers(authentication.organizationId, {
          email: body.email,
          limit: 1,
          skip: 0,
          sortBy: "createdAt",
          order: "desc",
        });
        if (oldUserResult.ok) {
          oldUserData = oldUserResult.data.data[0];
        }
      } catch (error) {
        logger.error(`Failed to fetch old user data for audit log: ${JSON.stringify(error)}`);
      }

      if (auditLog) {
        auditLog.targetId = oldUserData !== UNKNOWN_DATA ? oldUserData?.id : UNKNOWN_DATA;
      }

      const updateUserResult = await updateUser(body, authentication.organizationId);
      if (!updateUserResult.ok) {
        return handleApiError(request, updateUserResult.error, auditLog);
      }

      if (auditLog) {
        auditLog.targetId = auditLog.targetId === UNKNOWN_DATA ? updateUserResult.data.id : auditLog.targetId;
        auditLog.oldObject = oldUserData;
        auditLog.newObject = updateUserResult.data;
      }

      return responses.successResponse({ data: updateUserResult.data });
    },
    action: "updated",
    targetType: "user",
  });
