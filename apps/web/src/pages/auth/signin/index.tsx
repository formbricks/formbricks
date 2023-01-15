"use client";

import LayoutAuth from "@/components/layout/LayoutAuth";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SigninForm } from "@/components/auth/SigninForm";

export default function SignInPage() {
  const searchParams = useSearchParams();
  return (
    <LayoutAuth title="Sign in">
      <SigninForm callbackUrl={searchParams.get("callbackUrl")} error={searchParams.get("error")} />
      {process.env.NEXT_PUBLIC_SIGNUP_DISABLED !== "1" && (
        <div>
          <Link
            href="/auth/signup"
            className="text-sky mt-3 grid grid-cols-1 space-y-2 text-center text-xs hover:text-teal-600">
            Create an account
          </Link>
        </div>
      )}
    </LayoutAuth>
  );
}
