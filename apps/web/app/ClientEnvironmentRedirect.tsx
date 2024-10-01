"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@formbricks/lib/localStorage";

interface ClientEnvironmentRedirectProps {
  environmentId: string;
}

const ClientEnvironmentRedirect = ({ environmentId }: ClientEnvironmentRedirectProps) => {
  const router = useRouter();

  useEffect(() => {
    const lastEnvironmentId = localStorage.getItem(FORMBRICKS_ENVIRONMENT_ID_LS);

    if (lastEnvironmentId) {
      // Redirect to the last environment the user was in
      router.push(`/environments/${lastEnvironmentId}`);
    } else {
      router.push(`/environments/${environmentId}`);
    }
  }, [environmentId, router]);

  return null;
};

export default ClientEnvironmentRedirect;
