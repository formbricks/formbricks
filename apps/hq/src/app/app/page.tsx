"use client";

import { useMemberships } from "@/lib/memberships";
import { Button } from "@formbricks/ui";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LoadingSpinner from "../LoadingSpinner";

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const { memberships, isErrorMemberships } = useMemberships();
  const router = useRouter();

  useEffect(() => {
    if (session && memberships && memberships.length > 0) {
      const teamId = memberships[0].teamId;
      router.push(`/app/teams/${teamId}/forms`);
    }
  }, [memberships, router, session]);

  if (!session) {
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`);
    return <div></div>;
  }

  if (isErrorMemberships) {
    return <div>Something went wrong...</div>;
  }
  return (
    <div className="flex h-full w-full items-center justify-center">
      <LoadingSpinner />
    </div>
  );
}
