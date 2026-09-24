import type { TUsageRangeQuery } from "./range";

/** Typed query-key factory for the organization usage read. Never inline string keys. */
export const organizationUsageKeys = {
  all: ["organization-usage"] as const,
  usage: (organizationId: string, range: TUsageRangeQuery) =>
    [
      ...organizationUsageKeys.all,
      organizationId,
      range.preset ?? null,
      range.from ?? null,
      range.to ?? null,
    ] as const,
};
