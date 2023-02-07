"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { useMemberships } from "@/lib/memberships";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function BasePathPage() {
  const { memberships, isErrorMemberships } = useMemberships();
  const router = useRouter();

  useEffect(() => {
    if (memberships && memberships.length > 0) {
      const organisationId = memberships[0].organisationId;
      router.push(`/organisations/${organisationId}/forms`);
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
