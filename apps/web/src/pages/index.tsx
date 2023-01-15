"use client";

import LayoutApp from "@/components/layout/LayoutApp";
import { useMemberships } from "@/lib/memberships";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function ProjectsPage() {
  const { data: session } = useSession();
  const { memberships, isErrorMemberships } = useMemberships();
  const router = useRouter();

  useEffect(() => {
    if (session && memberships && memberships.length > 0) {
      const workspaceId = memberships[0].workspaceId;
      router.push(`/workspaces/${workspaceId}/forms`);
    }
    if (!session) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`);
    }
  }, [memberships, router, session]);

  if (isErrorMemberships) {
    return <div>Something went wrong...</div>;
  }
  return (
    <LayoutApp>
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    </LayoutApp>
  );
}
