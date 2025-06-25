"use client";

import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@/lib/localStorage";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ClientEnvironmentRedirectProps {
  userEnvironments: string[];
}

const ClientEnvironmentRedirect = ({ userEnvironments }: ClientEnvironmentRedirectProps) => {
  const router = useRouter();

  useEffect(() => {
    const lastEnvironmentId = localStorage.getItem(FORMBRICKS_ENVIRONMENT_ID_LS);

    if (lastEnvironmentId && userEnvironments.includes(lastEnvironmentId)) {
      router.push(`/environments/${lastEnvironmentId}`);
    } else {
      // If the last environmentId is not valid, remove it from localStorage and redirect to the provided environmentId
      localStorage.removeItem(FORMBRICKS_ENVIRONMENT_ID_LS);
      router.push(`/environments/${userEnvironments[0]}`);
    }
  }, [userEnvironments, router]);

  return null;
};

export default ClientEnvironmentRedirect;
