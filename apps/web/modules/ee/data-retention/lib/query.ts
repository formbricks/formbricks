import type { InfiniteData } from "@tanstack/react-query";
import type {
  TRetentionExemptionListInput,
  TRetentionExemptionListPage,
  TRetentionExemptionSurveyOptionsInput,
  TRetentionRunListInput,
  TRetentionRunListPage,
} from "./api-client";

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

/** Query keys for the Exemptions tab and the Add exemption survey picker. */
export const retentionExemptionKeys = {
  all: ["retention-exemptions"] as const,
  lists: () => [...retentionExemptionKeys.all, "list"] as const,
  list: (input: TRetentionExemptionListInput) => [...retentionExemptionKeys.lists(), input] as const,
  surveyOptions: (input: TRetentionExemptionSurveyOptionsInput) =>
    [...retentionExemptionKeys.all, "survey-options", input] as const,
};

export type TRetentionExemptionListKey = ReturnType<typeof retentionExemptionKeys.list>;

export const flattenRetentionExemptionPages = (data?: InfiniteData<TRetentionExemptionListPage>) =>
  data?.pages.flatMap((page) => page.data) ?? [];

/** The list with one exemption taken out, for an optimistic revoke. */
export const removeRetentionExemptionFromPages = (
  data: InfiniteData<TRetentionExemptionListPage> | undefined,
  exemptionId: string
): InfiniteData<TRetentionExemptionListPage> | undefined =>
  data && {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.filter((exemption) => exemption.id !== exemptionId),
    })),
  };

/** Query keys for the health banners: one per organisation, refreshed when a policy changes. */
export const retentionHealthKeys = {
  all: ["retention-health"] as const,
  detail: (organizationId: string) => [...retentionHealthKeys.all, organizationId] as const,
};

/** Query keys for the Policies tab: one document per organisation. */
export const retentionPolicyKeys = {
  all: ["retention-policies"] as const,
  detail: (organizationId: string) => [...retentionPolicyKeys.all, organizationId] as const,
};

/** Query keys for one survey's retention dates, refreshed when an exemption is added or revoked. */
export const surveyRetentionKeys = {
  all: ["survey-retention"] as const,
  detail: (surveyId: string) => [...surveyRetentionKeys.all, surveyId] as const,
};
