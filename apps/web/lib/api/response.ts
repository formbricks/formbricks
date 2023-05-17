import { NextApiResponse } from "next";
import { NextResponse } from "next/server";

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

export interface ApiSuccessResponse<T = { [key: string]: any }> {
  data: T;
}

export interface ApiErrorResponse {
  code: "not_found" | "bad_request" | "internal_server_error" | "unauthorized" | "method_not_allowed";
  message: string;
  details: {
    [key: string]: string | string[] | number | number[] | boolean | boolean[];
  };
}

export type CustomNextApiResponse = NextApiResponse<ApiResponse>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const badRequestResponse = (
  res: CustomNextApiResponse,
  message: string,
  details?: { [key: string]: string }
) =>
  res.status(400).json({
    code: "bad_request",
    message,
    details: details || {},
  });

const missingFieldResponse = (res: CustomNextApiResponse, field: string) =>
  badRequestResponse(res, `Missing ${field}`, {
    missing_field: field,
  });

const methodNotAllowedResponse = (res: CustomNextApiResponse, allowedMethods: string[]) =>
  res.status(405).json({
    code: "method_not_allowed",
    message: `The HTTP ${res.req?.method} method is not supported by this route.`,
    details: {
      allowed_methods: allowedMethods,
    },
  });

const notFoundResponse = (resourceType: string, resourceId: string, cors: boolean = false) =>
  NextResponse.json(
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
      ...(cors && { headers: corsHeaders }),
    }
  );

export const responses = {
  badRequestResponse,
  missingFieldResponse,
  methodNotAllowedResponse,
  notFoundResponse,
};
