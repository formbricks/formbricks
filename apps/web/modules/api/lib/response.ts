import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { ApiSuccessResponse } from "@/modules/api/types/api-success";

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const badRequestResponse = ({
  message,
  details = {},
  cors = false,
  cache = "private, no-store",
}: {
  message: string;
  details?: ApiErrorResponse["details"];
  cors?: boolean;
  cache?: string;
}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      type: "bad_request",
      message,
      details: details || {},
    } as ApiErrorResponse,
    {
      status: 400,
      headers,
    }
  );
};

const notFoundResponse = ({
  resourceType,
  resourceId,
  cors = false,
  cache = "private, no-store",
}: {
  resourceType: string;
  resourceId: string | null;
  cors?: boolean;
  cache?: string;
}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      type: "not_found",
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

const notAuthenticatedResponse = ({
  cors = false,
  cache = "private, no-store",
}: {
  cors?: boolean;
  cache?: string;
}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      type: "not_authenticated",
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

const unauthorizedResponse = ({
  cors = false,
  cache = "private, no-store",
}: {
  cors?: boolean;
  cache?: string;
}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      type: "unauthorized",
      message: "You are not authorized to access this resource",
      details: {},
    } as ApiErrorResponse,
    {
      status: 401,
      headers,
    }
  );
};

const forbiddenResponse = ({
  message,
  cors = false,
  details = {},
  cache = "private, no-store",
}: {
  message: string;
  cors?: boolean;
  details?: ApiErrorResponse["details"];
  cache?: string;
}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      type: "forbidden",
      message,
      details,
    } as ApiErrorResponse,
    {
      status: 403,
      headers,
    }
  );
};

const successResponse = ({
  data,
  metadata,
  cors = false,
  cache = "private, no-store",
}: {
  data: Object;
  metadata?: Record<string, unknown>;
  cors?: boolean;
  cache?: string;
}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      data,
      metadata,
    } as ApiSuccessResponse,
    {
      status: 200,
      headers,
    }
  );
};

const internalServerErrorResponse = ({
  message,
  cors = false,
  cache = "private, no-store",
}: {
  message: string;
  cors?: boolean;
  cache?: string;
}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      type: "internal_server_error",
      message,
      details: {},
    } as ApiErrorResponse,
    {
      status: 500,
      headers,
    }
  );
};

const tooManyRequestsResponse = ({
  message,
  cors = false,
  cache = "private, no-store",
}: {
  message: string;
  cors?: boolean;
  cache?: string;
}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      type: "internal_server_error",
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
  badRequestResponse,
  internalServerErrorResponse,
  notAuthenticatedResponse,
  unauthorizedResponse,
  notFoundResponse,
  successResponse,
  tooManyRequestsResponse,
  forbiddenResponse,
};
