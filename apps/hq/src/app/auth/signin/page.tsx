import Link from "next/link";
import { SigninForm } from "./SigninForm";

interface SignInPageProps {
  searchParams?: {
    callbackUrl?: string;
    error?: string;
  };
}

export default function SignInPage({ searchParams }: SignInPageProps) {
  return (
    <>
      <SigninForm callbackUrl={searchParams.callbackUrl} error={searchParams.error} />
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
