"use client";

import { RequestVerificationEmail } from "@/components/auth/RequestVerificationEmail";
import { useSearchParams } from "next/navigation";
import FormWrapper from "@/components/auth/FormWrapper";
import validator from "validator";

export default function VerificationPage() {
  const searchParams = useSearchParams();
  if (searchParams?.has("email")) {
    const emailParam = searchParams.get("email");
    if (validator.isEmail(emailParam ?? "")) {
      return (
        <FormWrapper>
          <>
            <h1 className="leading-2 mb-4 text-center text-lg font-semibold text-slate-900">
              Please confirm your email address
            </h1>
            <p className="text-center text-sm text-slate-700">
              We sent an email to <span className="font-semibold italic">{searchParams.get("email")}</span>.
              Please click the link in the email to activate your account.
            </p>
            <hr className="my-4" />
            <p className="text-center text-xs text-slate-500">
              You didn&apos;t receive an email or your link expired?
            </p>
            <div className="mt-5">
              <RequestVerificationEmail email={searchParams.get("email")} />
            </div>
          </>
        </FormWrapper>
      );
    } else {
      return <p className="text-center">Invalid email address</p>;
    }
  } else {
    return <p className="text-center">No email address provided</p>;
  }
}
