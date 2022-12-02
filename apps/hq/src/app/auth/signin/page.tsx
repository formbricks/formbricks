"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SigninForm } from "./SigninForm";

export default function SignInPage() {
  const searchParams = useSearchParams();
  return (
    <>
      <SigninForm callbackUrl={searchParams.get("callbackUrl")} error={searchParams.get("error")} />
      {process.env.NEXT_PUBLIC_SIGNUP_DISABLED !== "1" && (
        <div>
          <Link
            href="/auth/signup"
            className="text-sky mt-3 grid grid-cols-1 space-y-2 text-center text-xs hover:text-sky-600">
            Create an account
          </Link>
        </div>
      )}
    </>
  );
}
