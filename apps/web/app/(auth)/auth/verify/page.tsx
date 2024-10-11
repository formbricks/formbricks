"use client";

import { FormWrapper } from "@/app/(auth)/auth/components/FormWrapper";
import { SignIn } from "@/app/(auth)/auth/verify/components/SignIn";
import { useSearchParams } from "next/navigation";

const Page = () => {
  const searchParams = useSearchParams();
  return searchParams && searchParams?.get("token") ? (
    <FormWrapper>
      <p className="text-center">Verifying...</p>
      <SignIn token={searchParams.get("token")} />
    </FormWrapper>
  ) : (
    <p className="text-center">No Token provided</p>
  );
};

export default Page;
