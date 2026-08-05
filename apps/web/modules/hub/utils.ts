/** A single field-level validation failure from the Hub's RFC 9457 `invalid_params` extension. */
export type HubInvalidParam = { name: string; reason: string };

export type HubError = {
  status: number;
  message: string;
  detail: string;
  /**
   * Members parsed off the Hub's RFC 9457 problem body, when it returned one. Additive: `message` and
   * `detail` keep their existing meaning for current consumers.
   *
   * Only safe to relay to an API caller for 4xx — those describe the caller's own input. Never relay
   * them on 5xx, where they can carry upstream internals.
   */
  code?: string;
  problemDetail?: string;
  invalidParams?: HubInvalidParam[];
};

export type HubResult<T> = {
  data: T | null;
  error: HubError | null;
};

export const NO_CONFIG_ERROR = {
  status: 0,
  message: "HUB_API_KEY is not set; Hub integration is disabled.",
  detail: "HUB_API_KEY is not set; Hub integration is disabled.",
} as const;

/**
 * "Hub is switched off on this deployment" — as opposed to a Hub that is configured but unreachable.
 *
 * `status: 0` alone cannot tell them apart: the SDK reports a connection failure or timeout without a
 * status too, so `getErrorStatus` returns 0 for both. Match on the sentinel's message so a dead socket
 * still reads as an upstream fault (502) while a missing config reads as "not enabled here" (503).
 */
export const isHubNotConfigured = (error: HubError): boolean =>
  error.status === NO_CONFIG_ERROR.status && error.message === NO_CONFIG_ERROR.message;

export const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
};

// Duck-typed: `instanceof` against the SDK error class breaks under Next dev/Turbopack
// when @formbricks/hub is loaded into more than one module scope.
export const getErrorStatus = (err: unknown): number =>
  err && typeof err === "object" && typeof (err as { status?: unknown }).status === "number"
    ? (err as { status: number }).status
    : 0;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

/**
 * Reads the RFC 9457 problem members off a Hub SDK error (which exposes the parsed JSON body as
 * `error`). Duck-typed for the same reason as `getErrorStatus`: `instanceof` against the SDK error
 * class breaks when @formbricks/hub is loaded into more than one module scope under Next dev/Turbopack.
 */
export const getErrorProblem = (err: unknown): Pick<HubError, "code" | "problemDetail" | "invalidParams"> => {
  const body = asRecord(asRecord(err)?.error);
  if (!body) return {};

  const invalidParams = Array.isArray(body.invalid_params)
    ? body.invalid_params.flatMap((entry) => {
        const param = asRecord(entry);
        return param && typeof param.name === "string" && typeof param.reason === "string"
          ? [{ name: param.name, reason: param.reason }]
          : [];
      })
    : [];

  return {
    ...(typeof body.code === "string" ? { code: body.code } : {}),
    ...(typeof body.detail === "string" ? { problemDetail: body.detail } : {}),
    ...(invalidParams.length > 0 ? { invalidParams } : {}),
  };
};

export const createHubResultFromError = <T>(err: unknown): HubResult<T> => {
  const status = getErrorStatus(err);
  const message = getErrorMessage(err);
  return { data: null, error: { status, message, detail: message, ...getErrorProblem(err) } };
};
