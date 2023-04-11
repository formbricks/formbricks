"use client";

import { RequestVerificationEmail } from "@/components/auth/RequestVerificationEmail";
import { useSearchParams } from "next/navigation";

export default function VerficationPage() {
  const searchParams = useSearchParams();
  return (
    <div>
      {searchParams && searchParams?.get("email") ? (
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
      ) : (
        <p className="text-center">No E-Mail Address provided</p>
      )}
    </div>
  );
}
