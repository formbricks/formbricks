import useSWR from "swr";
import { fetcher } from "./fetcher";
import useSWRMutation from "swr/mutation";

export const useProfile = () => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(`/api/v1/users/me/`, fetcher);

  return {
    profile: data,
    isLoadingProfile: isLoading,
    isErrorProfile: error,
    isValidatingProfile: isValidating,
    mutateProfile: mutate,
  };
};

export const useProfileMutation = () => {
  const { trigger, isMutating } = useSWRMutation("/api/user", sendRequest);

  return {
    triggerProfileMutation: trigger,
    isMutatingProfile: isMutating,
  };
};

export const updateProfile = async (profile) => {
  console.log("updateProfile", profile);
  try {
    await fetch(`/api/v1/users/me/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
  } catch (error) {
    console.error(error);
  }
};
