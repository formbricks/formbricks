"use client";

import { useMemberships } from "@/lib/memberships";
import { Button } from "@formbricks/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LoadingSpinner from "../LoadingSpinner";

export default function ProjectsPage() {
  const { memberships, isErrorMemberships } = useMemberships();
  const router = useRouter();

  useEffect(() => {
    if (memberships) {
      const teamId = memberships[0].teamId;
      router.push(`/app/teams/${teamId}/forms`);
    }
  }, [memberships, router]);

  if (isErrorMemberships) {
    return <div>Something went wrong...</div>;
  }
  return (
    <div className="flex h-full w-full items-center justify-center">
      <LoadingSpinner />
    </div>
  );
}
