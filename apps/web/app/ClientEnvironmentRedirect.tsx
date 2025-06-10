"use client";

import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@/lib/localStorage";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ClientEnvironmentRedirectProps {
  environmentId: string;
  userEnvironments?: string[];
}

const ClientEnvironmentRedirect = ({ environmentId, userEnvironments }: ClientEnvironmentRedirectProps) => {
  const router = useRouter();

  useEffect(() => {
    const lastEnvironmentId = localStorage.getItem(FORMBRICKS_ENVIRONMENT_ID_LS);

    if (lastEnvironmentId && userEnvironments && userEnvironments.includes(lastEnvironmentId)) {
      router.push(`/environments/${lastEnvironmentId}`);
    } else {
      // If the last environmentId is not valid, remove it from localStorage and redirect to the provided environmentId
      if (lastEnvironmentId) {
        localStorage.removeItem(FORMBRICKS_ENVIRONMENT_ID_LS);
      }

      router.push(`/environments/${environmentId}`);
    }
  }, [environmentId, userEnvironments, router]);

  return null;
};

export default ClientEnvironmentRedirect;
