import { NextApiResponse } from "next";

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

const notFoundResponse = (res: CustomNextApiResponse, resourceType: string, resourceId: string) =>
  res.status(404).json({
    code: "not_found",
    message: `${resourceType} not found`,
    details: {
      resource_id: resourceId,
      resource_type: resourceType,
    },
  });

export const responses = {
  badRequestResponse,
  missingFieldResponse,
  methodNotAllowedResponse,
  notFoundResponse,
};
