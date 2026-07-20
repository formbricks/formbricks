import "server-only";

export const AUTHZED_REQUEST_TIMEOUT_MS = 1_000;
export const AUTHZED_MAX_ATTEMPTS = 3;
export const AUTHZED_RETRY_BASE_DELAYS_MS = [100, 200] as const;
export const AUTHZED_RETRY_JITTER_RATIO = 0.2;
