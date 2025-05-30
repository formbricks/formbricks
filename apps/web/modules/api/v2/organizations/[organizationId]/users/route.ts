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
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
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
    handler: async ({ authentication, parsedInput: { body, params } }) => {
      const auditLogBase = {
        actionType: "user.created" as const,
        targetType: "user" as const,
        userId: authentication.apiKeyId,
        userType: "api" as const,
        targetId: UNKNOWN_DATA, // Will be updated after creation
        organizationId: authentication.organizationId,
        status: "failure" as const,
        apiUrl: request.url,
      };

      if (IS_FORMBRICKS_CLOUD) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [
              { field: "organizationId", issue: "This endpoint is not supported on Formbricks Cloud" },
            ],
          },
          auditLogBase
        );
      }

      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Write)) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "organizationId", issue: "unauthorized" }],
          },
          auditLogBase
        );
      }

      const createUserResult = await createUser(body!, authentication.organizationId);
      if (!createUserResult.ok) {
        return handleApiError(request, createUserResult.error, auditLogBase);
      }

      queueAuditEvent({
        ...auditLogBase,
        targetId: createUserResult.data.id,
        status: "success",
        newObject: createUserResult.data,
      });

      return responses.createdResponse({ data: createUserResult.data });
    },
  });

export const PATCH = async (request: Request, props: { params: Promise<{ organizationId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      body: ZUserInputPatch,
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput: { body, params } }) => {
      const auditLogBase = {
        actionType: "user.updated" as const,
        targetType: "user" as const,
        userId: authentication.apiKeyId,
        userType: "api" as const,
        targetId: body?.email || UNKNOWN_DATA, // Assuming email is the identifier for update, or use UNKNOWN_DATA
        organizationId: authentication.organizationId,
        status: "failure" as const,
        apiUrl: request.url,
      };

      if (IS_FORMBRICKS_CLOUD) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [
              { field: "organizationId", issue: "This endpoint is not supported on Formbricks Cloud" },
            ],
          },
          auditLogBase
        );
      }

      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Write)) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "organizationId", issue: "unauthorized" }],
          },
          auditLogBase
        );
      }

      if (!body?.email) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "email", issue: "Email is required" }],
          },
          auditLogBase
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

      const updateUserResult = await updateUser(body, authentication.organizationId);
      if (!updateUserResult.ok) {
        return handleApiError(request, updateUserResult.error, auditLogBase);
      }

      queueAuditEvent({
        ...auditLogBase,
        targetId: updateUserResult.data.id,
        status: "success",
        oldObject: oldUserData,
        newObject: updateUserResult.data,
      });

      return responses.successResponse({ data: updateUserResult.data });
    },
  });
