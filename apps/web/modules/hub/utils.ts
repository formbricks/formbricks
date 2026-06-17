export type HubError = { status: number; message: string; detail: string };

export type HubResult<T> = {
  data: T | null;
  error: HubError | null;
};

export const NO_CONFIG_ERROR = {
  status: 0,
  message: "HUB_API_KEY is not set; Hub integration is disabled.",
  detail: "HUB_API_KEY is not set; Hub integration is disabled.",
} as const;

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

export const createHubResultFromError = <T>(err: unknown): HubResult<T> => {
  const status = getErrorStatus(err);
  const message = getErrorMessage(err);
  return { data: null, error: { status, message, detail: message } };
};

export const toQueryString = (params: Record<string, string | number | undefined>): string => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // Only `undefined` is omitted ("not provided"). Empty strings are preserved: a taxonomy
    // scope with source_id="" is the "no source" bucket — a real, comparable scope value, not
    // the absence of a filter. Dropping it would make active-tree/run reads behave like
    // "no source filter" instead of "the unattributed bucket". See Hub PR #88.
    if (value !== undefined) {
      query.set(key, String(value));
    }
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
};
