"use client";

import { fetcher } from "@formbricks/lib/fetcher";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

export function HomeRedirect() {
  const { data, error } = useSWR(`/api/v1/environments/find-first`, fetcher);

  useEffect(() => {
    if (data && !error) {
      return redirect(`/environments/${data.id}`);
    } else if (error) {
      console.error(error);
    }
  }, [data, error]);

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
