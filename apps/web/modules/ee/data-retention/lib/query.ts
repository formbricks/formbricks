import type { InfiniteData } from "@tanstack/react-query";
import type { TRetentionRunListInput, TRetentionRunListPage } from "./api-client";

/**
 * Query keys for History. `includeEmpty` is part of the list key on purpose: the API binds a cursor to
 * it, so flipping the toggle has to start a new page sequence rather than reuse the old cursors.
 */
export const retentionRunKeys = {
  all: ["retention-runs"] as const,
  lists: () => [...retentionRunKeys.all, "list"] as const,
  list: (input: TRetentionRunListInput) => [...retentionRunKeys.lists(), input] as const,
};

export const flattenRetentionRunPages = (data?: InfiniteData<TRetentionRunListPage>) =>
  data?.pages.flatMap((page) => page.data) ?? [];
