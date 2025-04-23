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
import { NextRequest } from "next/server";
import { z } from "zod";
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
      if (IS_FORMBRICKS_CLOUD) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "organizationId", issue: "This endpoint is not supported on Formbricks Cloud" }],
        });
      }

      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Write)) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const createUserResult = await createUser(body!, authentication.organizationId);
      if (!createUserResult.ok) {
        return handleApiError(request, createUserResult.error);
      }

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
      if (IS_FORMBRICKS_CLOUD) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "organizationId", issue: "This endpoint is not supported on Formbricks Cloud" }],
        });
      }

      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Write)) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      if (!body?.email) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "email", issue: "Email is required" }],
        });
      }

      const updateUserResult = await updateUser(body, authentication.organizationId);
      if (!updateUserResult.ok) {
        return handleApiError(request, updateUserResult.error);
      }

      return responses.successResponse({ data: updateUserResult.data });
    },
  });
