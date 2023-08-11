"use client";

import { useSearchParams } from "next/navigation";
import FormWrapper from "@/app/(auth)/auth/FormWrapper";
import { SignIn } from "./SignIn";

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
