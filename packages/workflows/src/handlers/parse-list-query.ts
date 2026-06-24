import {
  type TListWorkflowRunsInput,
  type TListWorkflowsInput,
  ZListWorkflowRunsInput,
  ZListWorkflowsInput,
} from "../contracts";

/**
 * Multi-value filters accept repeated keys or comma-separated values
 * (`filter[status][in]=draft&filter[status][in]=disabled` or `filter[status][in]=draft,disabled`),
 * matching the v3 survey list. Returns `undefined` when absent so Zod applies its default/optional.
 */
const multiValue = (searchParams: URLSearchParams, key: string): string[] | undefined => {
  const values = searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return values.length > 0 ? values : undefined;
};

/**
 * Map the literal `filter[isDryRun][eq]` query value to a boolean. `"true"`/`"false"` map to the
 * boolean; absent maps to `undefined` (omit → both real and dry runs); any other value is passed
 * through verbatim so Zod rejects it with a 400 rather than silently coercing.
 */
const parseBooleanParam = (value: string | null): boolean | string | undefined => {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

/**
 * Map the HTTP query family to the contract's `ZListWorkflowsInput` shape, then validate. Only the
 * recognized keys are read; unrecognized query params are ignored (lenient, matching the v3 survey
 * list, so third-party callers can append their own params). A bad value (enum/limit/cursor) throws
 * a `ZodError` the handler maps to a 400.
 */
export const parseListWorkflowsQuery = (searchParams: URLSearchParams): TListWorkflowsInput => {
  const raw: Record<string, unknown> = {
    workspaceId: searchParams.get("workspaceId") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    statusIn: multiValue(searchParams, "filter[status][in]"),
    nameContains: searchParams.get("filter[name][contains]") ?? undefined,
    sortBy: searchParams.get("sortBy") ?? undefined,
  };

  if (searchParams.has("limit")) {
    raw.limit = Number(searchParams.get("limit"));
  }

  return ZListWorkflowsInput.parse(raw);
};

/**
 * Map the HTTP query family to the contract's `ZListWorkflowRunsInput` shape, then validate. Runs are
 * always newest-first (no `sortBy`); the supported filters are `workflowId`, `responseId`,
 * `filter[status][in]`, and `filter[isDryRun][eq]`. Unrecognized query params are ignored (lenient,
 * as above); a bad value throws a `ZodError` (→ 400).
 */
export const parseListWorkflowRunsQuery = (searchParams: URLSearchParams): TListWorkflowRunsInput => {
  const raw: Record<string, unknown> = {
    workspaceId: searchParams.get("workspaceId") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    workflowId: searchParams.get("workflowId") ?? undefined,
    responseId: searchParams.get("responseId") ?? undefined,
    statusIn: multiValue(searchParams, "filter[status][in]"),
    isDryRun: parseBooleanParam(searchParams.get("filter[isDryRun][eq]")),
  };

  if (searchParams.has("limit")) {
    raw.limit = Number(searchParams.get("limit"));
  }

  return ZListWorkflowRunsInput.parse(raw);
};
