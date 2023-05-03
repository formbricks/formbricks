"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { fetcher } from "@formbricks/lib/fetcher";
import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";

interface HomeRedirectProps {
  session: Session;
}

export function HomeRedirect({ session }: HomeRedirectProps) {
  const { data, error } = useSWR(`/api/v1/environments/find-first`, fetcher);

  useEffect(() => {
    if (session) {
      if (!session.user?.onboardingDisplayed) {
        return redirect(`/onboarding`);
      }

      if (data && !error) {
        return redirect(`/environments/${data.id}`);
      } else if (error) {
        console.error(error);
      }
    } else {
      return redirect(`/auth/login`);
    }
  }, [data, error, session]);

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
