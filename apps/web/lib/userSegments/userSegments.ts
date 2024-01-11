import useSWR from "swr";

import { fetcher } from "@formbricks/lib/fetcher";
import { TUserSegment } from "@formbricks/types/userSegment";

export const useUserSegments = (environmentId: string) => {
  const { data, isLoading, error, mutate } = useSWR<TUserSegment[]>(
    `/api/v1/environments/${environmentId}/user-segments`,
    fetcher
  );

  return {
    userSegments: data,
    isLoadingUserSegments: isLoading,
    isErrorUserSegments: error,
    mutateUserSegments: mutate,
  };
};

export const useUserSegment = (environmentId: string, userSegmentId: string) => {
  const { data, isLoading, error, mutate } = useSWR<
    TUserSegment & { activeSurveys: string[]; inactiveSurveys: string[] }
  >(`/api/v1/environments/${environmentId}/user-segments/${userSegmentId}`, fetcher);

  return {
    userSegment: data,
    isLoadingUserSegment: isLoading,
    isErrorUserSegment: error,
    mutateUserSegment: mutate,
  };
};
