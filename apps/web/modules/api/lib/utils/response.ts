import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { ApiSuccessResponse } from "@/modules/api/types/api-success";

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const goneResponse = (
  message: string,
  details?: { [key: string]: string },
  cors: boolean = false,
  cache: string = "private, no-store"
) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      code: "gone",
      message,
      details: details || {},
    } as ApiErrorResponse,
    {
      status: 410,
      headers,
    }
  );
};

const badRequestResponse = (
  message: string,
  details?: { [key: string]: string },
  cors: boolean = false,
  cache: string = "private, no-store"
) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      code: "bad_request",
      message,
      details: details || {},
    } as ApiErrorResponse,
    {
      status: 400,
      headers,
    }
  );
};

const notFoundResponse = (
  resourceType: string,
  resourceId: string | null,
  cors: boolean = false,
  cache: string = "private, no-store"
) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      code: "not_found",
      message: `${resourceType} not found`,
      details: {
        resource_id: resourceId,
        resource_type: resourceType,
      },
    } as ApiErrorResponse,
    {
      status: 404,
      headers,
    }
  );
};

const notAuthenticatedResponse = (cors: boolean = false, cache: string = "private, no-store") => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      code: "not_authenticated",
      message: "Not authenticated",
      details: {
        "x-Api-Key": "Header not provided or API Key invalid",
      },
    } as ApiErrorResponse,
    {
      status: 401,
      headers,
    }
  );
};

const unauthorizedResponse = (cors: boolean = false, cache: string = "private, no-store") => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      code: "unauthorized",
      message: "You are not authorized to access this resource",
      details: {},
    } as ApiErrorResponse,
    {
      status: 401,
      headers,
    }
  );
};

const forbiddenResponse = (
  message: string,
  cors: boolean = false,
  details: ApiErrorResponse["details"] = {},
  cache: string = "private, no-store"
) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      code: "forbidden",
      message,
      details,
    } as ApiErrorResponse,
    {
      status: 403,
      headers,
    }
  );
};

const successResponse = (data: Object, cors: boolean = false, cache: string = "private, no-store") => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      data,
    } as ApiSuccessResponse<typeof data>,
    {
      status: 200,
      headers,
    }
  );
};

const internalServerErrorResponse = (
  message: string,
  cors: boolean = false,
  cache: string = "private, no-store"
) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      code: "internal_server_error",
      message,
      details: {},
    } as ApiErrorResponse,
    {
      status: 500,
      headers,
    }
  );
};

const tooManyRequestsResponse = (
  message: string,
  cors: boolean = false,
  cache: string = "private, no-store"
) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      code: "internal_server_error",
      message,
      details: {},
    } as ApiErrorResponse,
    {
      status: 429,
      headers,
    }
  );
};

export const responses = {
  goneResponse,
  badRequestResponse,
  internalServerErrorResponse,
  notAuthenticatedResponse,
  unauthorizedResponse,
  notFoundResponse,
  successResponse,
  tooManyRequestsResponse,
  forbiddenResponse,
};
