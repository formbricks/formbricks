"use client";

import LayoutAuth from "@/components/layout/LayoutAuth";
import Link from "next/link";
import { SigninForm } from "@/components/auth/SigninForm";
import { useRouter } from "next/router";

export default function SignInPage() {
  const router = useRouter();
  return (
    <LayoutAuth title="Sign in">
      <SigninForm callbackUrl={router.query.callbackUr} error={router.query.error} />
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
