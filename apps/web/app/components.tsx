"use client";

import { fetcher } from "@formbricks/lib/fetcher";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";

export function HomeRedirect() {
  const { data, error } = useSWR(`/api/v1/environments/find-first`, fetcher);

  useEffect(() => {
    if (data && !error) {
      return redirect(`/environments/${data.id}`);
    }
  }, [data, error]);

  return <div>{error && error.toString()}</div>;
}
