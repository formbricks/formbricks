import { fetcher } from "@formbricks/lib/fetcher";
import { TUserSegment } from "@formbricks/types/v1/userSegment";
import useSWR from "swr";

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
