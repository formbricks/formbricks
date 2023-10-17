"use client";

import { useSearchParams } from "next/navigation";
import { SignIn } from "@/app/(auth)/auth/verify/components/SignIn";
import FormWrapper from "@/app/(auth)/auth/components/FormWrapper";

export default function Verify() {
  const searchParams = useSearchParams();
  return searchParams && searchParams?.get("token") ? (
    <FormWrapper>
      <p className="text-center">Verifying...</p>
      <SignIn token={searchParams.get("token")} />
    </FormWrapper>
  ) : (
    <p className="text-center">No Token provided</p>
  );
}
