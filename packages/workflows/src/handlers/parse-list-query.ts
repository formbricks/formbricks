import { type TListWorkflowsInput, ZListWorkflowsInput } from "../contracts";

/**
 * Map the HTTP `filter[...]` query family to the contract's `ZListWorkflowsInput` shape, then
 * validate. Multi-value filters accept repeated keys or comma-separated values
 * (`filter[status][in]=draft&filter[status][in]=disabled` or `filter[status][in]=draft,disabled`),
 * matching the v3 survey list. Validation (unknown params, bad enum/limit) throws a `ZodError` the
 * handler maps to a 400.
 */
export const parseListWorkflowsQuery = (searchParams: URLSearchParams): TListWorkflowsInput => {
  const multiValue = (key: string): string[] | undefined => {
    const values = searchParams
      .getAll(key)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    return values.length > 0 ? values : undefined;
  };

  const raw: Record<string, unknown> = {
    workspaceId: searchParams.get("workspaceId") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    statusIn: multiValue("filter[status][in]"),
    nameContains: searchParams.get("filter[name][contains]") ?? undefined,
    sortBy: searchParams.get("sortBy") ?? undefined,
  };

  if (searchParams.has("limit")) {
    raw.limit = Number(searchParams.get("limit"));
  }

  return ZListWorkflowsInput.parse(raw);
};
