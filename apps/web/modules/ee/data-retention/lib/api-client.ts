import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TRetentionRun } from "../types";

const BASE_PATH = "/api/internal/retention-runs";

export type TRetentionRunListPage = {
  data: TRetentionRun[];
  meta: { limit: number; nextCursor: string | null };
};

export type TRetentionRunListInput = {
  organizationId: string;
  /** Include runs that changed nothing. History hides them by default. */
  includeEmpty: boolean;
  limit: number;
};

export const buildRetentionRunsSearchParams = ({
  organizationId,
  includeEmpty,
  limit,
  cursor,
}: TRetentionRunListInput & { cursor: string | null }): URLSearchParams => {
  const params = new URLSearchParams({
    organizationId,
    limit: String(limit),
    includeEmpty: String(includeEmpty),
  });
  if (cursor) params.set("cursor", cursor);
  return params;
};

export async function listRetentionRuns({
  signal,
  ...input
}: TRetentionRunListInput & { cursor: string | null; signal?: AbortSignal }): Promise<TRetentionRunListPage> {
  const response = await fetch(`${BASE_PATH}?${buildRetentionRunsSearchParams(input)}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return (await response.json()) as TRetentionRunListPage;
}

/** The History CSV. A plain link: the browser downloads the streamed file itself. */
export const getRetentionExportUrl = (organizationId: string): string =>
  `${BASE_PATH}/export?${new URLSearchParams({ organizationId })}`;
