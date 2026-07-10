import { NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { OrganizationAccessType } from "@formbricks/types/api-key";
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
  canAssignOrganizationRole,
  canManageOrganizationUsers,
  canModifyOrganizationMember,
  getApiKeyCreatorRole,
  getMembershipRoleByEmail,
} from "@/modules/api/v2/organizations/[organizationId]/users/lib/utils";
import {
  ZGetUsersFilter,
  ZUserInput,
  ZUserInputPatch,
} from "@/modules/api/v2/organizations/[organizationId]/users/types/users";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";

export const GET = async (request: NextRequest, props: { params: Promise<{ organizationId: string }> }) =>
  authenticatedApiClient({
    request,
    allowOrganizationOnlyApiKey: true,
    schemas: {
      query: ZGetUsersFilter,
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
    allowOrganizationOnlyApiKey: true,
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

      // Org API keys carry no role of their own, so anchor authorization to the API key creator's
      // role. First enforce the org's user-management floor (USER_MANAGEMENT_MINIMUM_ROLE), then
      // clamp the assignable role. This mirrors the settings/session-path guard and stops a manager
      // from escalating a user (or themselves) to owner through the management API.
      const assignerRole = await getApiKeyCreatorRole(authentication.apiKeyId, authentication.organizationId);
      if (!canManageOrganizationUsers(assignerRole)) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [{ field: "user", issue: "You are not allowed to manage users in this organization" }],
          },
          auditLog
        );
      }
      if (!canAssignOrganizationRole(assignerRole, body!.role)) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [{ field: "role", issue: "You are not allowed to assign this role" }],
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
    allowOrganizationOnlyApiKey: true,
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

      // Org API keys carry no role of their own, so anchor authorization to the API key creator's
      // role. First enforce the org's user-management floor (USER_MANAGEMENT_MINIMUM_ROLE). Then a
      // non-owner may not touch an existing owner's membership at all (role, active state, email, or
      // teams), and when a role change is requested it must not exceed what the creator may assign.
      // This mirrors the settings/session-path guard.
      const [assignerRole, targetCurrentRole] = await Promise.all([
        getApiKeyCreatorRole(authentication.apiKeyId, authentication.organizationId),
        getMembershipRoleByEmail(body.email, authentication.organizationId),
      ]);
      if (!canManageOrganizationUsers(assignerRole)) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [{ field: "user", issue: "You are not allowed to manage users in this organization" }],
          },
          auditLog
        );
      }
      if (
        !canModifyOrganizationMember(assignerRole, targetCurrentRole) ||
        (body.role && !canAssignOrganizationRole(assignerRole, body.role, targetCurrentRole))
      ) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [{ field: "role", issue: "You are not allowed to modify this user" }],
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
