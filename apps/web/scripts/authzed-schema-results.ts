export const INVALID_REQUEST_RESULT = {
  code: "authzed_invalid_request",
  retryable: false,
  status: "failed",
} as const;

export const INVALID_CONFIGURATION_RESULT = {
  code: "authzed_internal",
  retryable: false,
  status: "failed",
} as const;
