"use client";

import { SignIn } from "@/app/components/auth/SignIn";
import { useSearchParams } from "next/navigation";
import FormWrapper from "@/app/components/auth/FormWrapper";

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
