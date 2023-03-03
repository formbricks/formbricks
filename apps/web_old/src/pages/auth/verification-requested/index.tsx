"use client";

import LayoutAuth from "@/components/layout/LayoutAuth";
import { RequestVerificationEmail } from "@/components/auth/RequestVerificationEmail";
import { useRouter } from "next/router";

export default function VerficationPage() {
  const router = useRouter();
  return (
    <LayoutAuth title="Email verification required">
      {router.query.email ? (
        <>
          <h1 className="leading-2 mb-4 text-center font-bold">Please verify your email address</h1>
          <p className="text-center">
            We have sent you an email to the address <span className="italic">{router.query.email}</span>.
            Please click the link in the email to activate your account.
          </p>
          <hr className="my-4" />
          <p className="text-center text-xs">
            You didn&apos;t receive an email or your link expired?
            <br />
            Click the button below to request a new email.
          </p>
          <div className="mt-5">
            <RequestVerificationEmail email={router.query.email.toString()} />
          </div>
        </>
      ) : (
        <p className="text-center">No E-Mail Address provided</p>
      )}
    </LayoutAuth>
  );
}
