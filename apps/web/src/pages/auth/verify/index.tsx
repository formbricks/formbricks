"use client";

import { useSearchParams } from "next/navigation";
import { SignIn } from "@/components/auth/SignIn";
import LayoutAuth from "@/components/layout/LayoutAuth";

export default function Verify() {
  const searchParams = useSearchParams();
  return (
    <LayoutAuth title="Verify">
      <p className="text-center">{!searchParams.get("token") ? "No Token provided" : "Verifying..."}</p>
      <SignIn token={searchParams.get("token")} />
    </LayoutAuth>
  );
}
