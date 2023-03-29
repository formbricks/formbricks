import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";

export const useProfile = () => {
  const { data, isLoading, error, mutate, isValidating } = useSWR("/api/v1/users/me/", fetcher);

  return {
    profile: data,
    isLoadingProfile: isLoading,
    isErrorProfile: error,
    isValidatingProfile: isValidating,
    mutateProfile: mutate,
  };
};
