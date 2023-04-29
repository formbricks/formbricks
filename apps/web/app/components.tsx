"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProfile } from "@/lib/profile";
import { fetcher } from "@formbricks/lib/fetcher";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";

export function HomeRedirect() {
  const { data, error } = useSWR(`/api/v1/environments/find-first`, fetcher);
  const { profile, isErrorProfile } = useProfile();

  useEffect(() => {
    if (profile) {
      if (!profile.onboardingDisplayed && !isErrorProfile) {
        return redirect(`/onboarding`);
      } else if (isErrorProfile) {
        console.error(isErrorProfile);
      }

      if (data && !error) {
        return redirect(`/environments/${data.id}`);
      } else if (error) {
        console.error(error);
      }
    }
  }, [data, error, profile, isErrorProfile])

  if (error) {
    setTimeout(() => {
      signOut();
    }, 3000);
    return <div>There was an error with your current Session. You are getting redirected to the login.</div>;
  }

  return (
    <div>
      <LoadingSpinner />
    </div>
  );
}
