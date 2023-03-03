import { SigninForm } from "@/components/auth/SigninForm";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div>
      <SigninForm />
      {process.env.NEXT_PUBLIC_SIGNUP_DISABLED !== "1" && (
        <div>
          <Link
            href="/auth/signup"
            className="text-sky mt-3 grid grid-cols-1 space-y-2 text-center text-xs hover:text-teal-600">
            Create an account
          </Link>
        </div>
      )}
    </div>
  );
}
