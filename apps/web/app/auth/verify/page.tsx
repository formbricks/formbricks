"use client";

import { SignIn } from "@/components/auth/SignIn";
import { useSearchParams } from "next/navigation";

export default function Verify() {
  const searchParams = useSearchParams();
  return searchParams && searchParams?.get("token") ? (
    <div>
      <p className="text-center">Verifying...</p>
      <SignIn token={searchParams.get("token")} />
    </div>
  ) : (
    <p className="text-center">No Token provided</p>
  );
}
