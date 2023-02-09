import LayoutAuth from "@/components/layout/LayoutAuth";
import Link from "next/link";
import { SignupForm } from "../../../components/auth/SignupForm";

export default function SignUpPage() {
  return (
    <LayoutAuth title="Create Account">
      {process.env.NEXT_PUBLIC_SIGNUP_DISABLED === "1" ? (
        <>
          <h1 className="leading-2 mb-4 text-center font-bold">Sign up disabled</h1>
          <p className="text-center">
            The account creation is disabled in this instance. Please contact the site administrator to create
            an account.
          </p>
          <hr className="my-4" />
          <Link
            href="/"
            className="mt-5 flex w-full justify-center rounded-md border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
            Login
          </Link>
        </>
      ) : (
        <SignupForm />
      )}
    </LayoutAuth>
  );
}
