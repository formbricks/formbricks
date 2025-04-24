import { ApiErrorDetails, ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiSuccessResponse } from "@/modules/api/v2/types/api-success";

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponseV2;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const badRequestResponse = ({
  details = [],
  cors = false,
  cache = "private, no-store",
}: {
  details?: ApiErrorDetails;
  cors?: boolean;
  cache?: string;
} = {}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      error: {
        code: 400,
        message: "Bad Request",
        details,
      },
    },
    {
      status: 400,
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
} = {}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      error: {
        code: 401,
        message: "Unauthorized",
      },
    },
    {
      status: 401,
      headers,
    }
  );
};

const forbiddenResponse = ({
  cors = false,
  cache = "private, no-store",
}: {
  cors?: boolean;
  cache?: string;
} = {}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      error: {
        code: 403,
        message: "Forbidden",
      },
    },
    {
      status: 403,
      headers,
    }
  );
};

const notFoundResponse = ({
  details = [],
  cors = false,
  cache = "private, no-store",
}: {
  details?: ApiErrorDetails;
  cors?: boolean;
  cache?: string;
}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      error: {
        code: 404,
        message: "Not Found",
        details,
      },
    },
    {
      status: 404,
      headers,
    }
  );
};

const conflictResponse = ({
  cors = false,
  cache = "private, no-store",
  details = [],
}: {
  cors?: boolean;
  cache?: string;
  details?: ApiErrorDetails;
} = {}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      error: {
        code: 409,
        message: "Conflict",
        details,
      },
    },
    {
      status: 409,
      headers,
    }
  );
};

const unprocessableEntityResponse = ({
  details = [],
  cors = false,
  cache = "private, no-store",
}: {
  details: ApiErrorDetails;
  cors?: boolean;
  cache?: string;
}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      error: {
        code: 422,
        message: "Unprocessable Entity",
        details,
      },
    },
    {
      status: 422,
      headers,
    }
  );
};

const tooManyRequestsResponse = ({
  cors = false,
  cache = "private, no-store",
}: {
  cors?: boolean;
  cache?: string;
} = {}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      error: {
        code: 429,
        message: "Too Many Requests",
      },
    },
    {
      status: 429,
      headers,
    }
  );
};

const internalServerErrorResponse = ({
  details = [],
  cors = false,
  cache = "private, no-store",
}: {
  details?: ApiErrorDetails;
  cors?: boolean;
  cache?: string;
} = {}) => {
  const headers = {
    ...(cors && corsHeaders),
    "Cache-Control": cache,
  };

  return Response.json(
    {
      error: {
        code: 500,
        message: "Internal Server Error",
        details,
      },
    },
    {
      status: 500,
      headers,
    }
  );
};

const successResponse = ({
  data,
  meta,
  cors = true,
  cache = "private, no-store",
}: {
  data: Object;
  meta?: Record<string, unknown>;
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
      meta,
    } as ApiSuccessResponse,
    {
      status: 200,
      headers,
    }
  );
};

export const createdResponse = ({
  data,
  meta,
  cors = false,
  cache = "private, no-store",
}: {
  data: Object;
  meta?: Record<string, unknown>;
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
      meta,
    } as ApiSuccessResponse,
    {
      status: 201,
      headers,
    }
  );
};

export const multiStatusResponse = ({
  data,
  meta,
  cors = false,
  cache = "private, no-store",
}: {
  data: Object;
  meta?: Record<string, unknown>;
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
      meta,
    } as ApiSuccessResponse,
    {
      status: 207,
      headers,
    }
  );
};

export const responses = {
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  unprocessableEntityResponse,
  tooManyRequestsResponse,
  internalServerErrorResponse,
  successResponse,
  createdResponse,
  multiStatusResponse,
};
